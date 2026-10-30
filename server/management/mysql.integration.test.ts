import { beforeAll, afterAll, describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import mysql from "mysql2/promise";
import { management } from "./service";
import { mysqlRepository } from "./repository";
import { available, type Repository } from "./domain";
import { checkDatabaseReadiness } from "../db";
import { appRouter } from "../routers";
import { hotelToday } from "../../shared/operations";
import { categories, categoryAdministration, createCategory, publicCategoryMedia } from "./categories";
import { storeMedia,publishMedia,mediaFile,listManagedMedia } from "../media/storage";
import { pngFixture,mp4Fixture } from "../media/fixtures";
import { listBookingNotifications } from "../bookingNotifications";
import { recoverBooking } from "../bookingRecovery";
import {readMediaPlacements,readPublicMedia,saveMediaPlacement} from '../media/placementRepository';

// Never runs against a caller-supplied remote database. The launcher and this
// independent guard both verify the owned local instance before any test writes.
describe.skipIf(process.env.SOUTHSIDE_INTEGRATION !== "1")("owned MySQL integration", () => {
  let c: mysql.Connection;
  let actorId: number;
  const clock = () => new Date();
  const day = (offset: number) => new Date(Date.parse(hotelToday()) + offset * 86400000).toISOString().slice(0, 10);
  const service = management();
  const reason = "Fictional local integration test";
  beforeAll(async () => {
    const config = JSON.parse(fs.readFileSync(path.resolve(".local/database.json"), "utf8"));
    const url = new URL(process.env.DATABASE_URL!);
    expect(config.marker).toBe("southside-owned-local-mysql-v1");
    expect(url.hostname).toBe("127.0.0.1");
    expect(url.port).toBe("3307");
    expect(url.pathname).toBe("/southside_integration");
    expect(decodeURIComponent(url.username)).toBe(config.test.user);
    c = await mysql.createConnection(process.env.DATABASE_URL!);
    const [identity]: any = await c.query("SELECT @@datadir AS datadir, @@port AS port, VERSION() AS version");
    expect(path.resolve(identity[0].datadir)).toBe(path.resolve(".local/mysql-data"));
    expect(identity[0].port).toBe(3307);
    expect(identity[0].version).toMatch(/^8\./);
    const [user]: any = await c.execute("INSERT INTO users (openId, name, role) VALUES (?, ?, 'user')", [`test-${crypto.randomUUID()}`, "Fictional integration actor, no login"]);
    actorId = user.insertId;
    // Services are exercised directly with an ordinary FK fixture actor.
    // No browser session or administrator is created; router denial is tested below.
    await c.execute("INSERT INTO hotel_settings (settingKey, settingValue, verification) VALUES ('approved_booking_terms', ?, 'confirmed') ON DUPLICATE KEY UPDATE settingValue = VALUES(settingValue)", ["LOCAL TEST ONLY: no real stay or payment."]);
  });
  afterAll(async () => { await c?.end(); });
  async function fixture(capacity = 2) {
    const key = crypto.randomUUID();
    const [row]: any = await c.execute("INSERT INTO room_categories (slug, name, maxOccupancy, sellableInventory, isActive) VALUES (?, ?, 2, ?, 1)", [`test-${key}`, "Fictional integration category", capacity]);
    const categoryId = row.insertId;
    await c.execute("INSERT INTO inventory_policies (roomCategoryId, reconciledCapacity, cancellationReconciledAt, reconciledBy, reason) VALUES (?, ?, NOW(), ?, ?)", [categoryId, capacity, actorId, reason]);
    await c.execute("INSERT INTO room_rates (roomCategoryId, amount, isActive) VALUES (?, '100.10', 1)", [categoryId]);
    const roomIds: number[] = [];
    for (let i = 0; i < capacity; i++) {
      const [room]: any = await c.execute("INSERT INTO physical_rooms (roomCategoryId, label, housekeepingStatus) VALUES (?, ?, 'inspected')", [categoryId, `TEST-${key}-${i}`]);
      roomIds.push(room.insertId);
    }
    const input = { roomCategoryId: categoryId, checkIn: day(1), checkOut: day(3), rooms: 1, adults: 1, children: 0, name: "Fictional Guest", email: "fictional@example.invalid", phone: "0000000000" };
    const execute = (operation: any) => service.execute({ categoryId, reason, ...operation }, actorId);
    return { categoryId, roomIds, input, execute };
  }
  async function stock(categoryId: number) {
    const s = await service.snapshot(categoryId);
    return available(s, day(1), day(3), clock());
  }
  it("deduplicates concurrent persistent identifiers and queues exactly two disabled notices",async()=>{
    const f=await fixture(1),submissionId=crypto.randomUUID();
    const results=await Promise.all(Array.from({length:5},()=>service.createPublic({...f.input,submissionId})));
    expect(new Set(results.map(r=>r.reference)).size).toBe(1);
    const s=await service.snapshot(f.categoryId);expect(s.reservations).toHaveLength(1);expect(s.guests).toHaveLength(1);
    expect((await recoverBooking(submissionId))?.reference).toBe(results[0].reference);
    expect((await recoverBooking(submissionId.toUpperCase()))?.reference).toBe(results[0].reference);
    expect((await service.createPublic({...f.input,submissionId:submissionId.toUpperCase()})).reference).toBe(results[0].reference);
    expect(await recoverBooking(crypto.randomUUID())).toBeNull();
    const [maps]:any=await c.execute("SELECT * FROM booking_submissions WHERE reservationId=?",[results[0].reservationId]);expect(maps).toHaveLength(1);expect(maps[0].keyHash).not.toBe(submissionId);
    const [notices]:any=await c.execute("SELECT * FROM booking_notifications WHERE reservationId=?",[results[0].reservationId]);expect(notices).toHaveLength(2);expect(notices.every((n:any)=>n.state==="disabled"&&n.attempts===0)).toBe(true);
    await expect(service.createPublic({...f.input,submissionId,rooms:2})).rejects.toThrow(/different booking details/);
    await f.execute({action:"reservation.status",reservationId:results[0].reservationId,expectedStatus:results[0].status,status:"cancelled"});
    expect((await service.createPublic({...f.input,submissionId})).status).toBe("cancelled");
    expect((await recoverBooking(submissionId))?.status).toBe("cancelled");
    const queue=await listBookingNotifications();expect(queue.delivery.enabled).toBe(false);expect(queue.rows.find(r=>r.reference===results[0].reference)?.text).toContain("Current saved status: cancelled");
  });
  it("does not create two reservations when an identifier races across categories",async()=>{
    const a=await fixture(),b=await fixture(),submissionId=crypto.randomUUID();
    const results=await Promise.allSettled([service.createPublic({...a.input,submissionId}),service.createPublic({...b.input,submissionId})]);
    expect(results.filter(r=>r.status==="fulfilled")).toHaveLength(1);expect((await service.snapshot(a.categoryId)).reservations.length+(await service.snapshot(b.categoryId)).reservations.length).toBe(1);
  });
  it("rolls back a new guest, booking and identifier on outbox failure then safely retries",async()=>{
    const f=await fixture(),input={...f.input,submissionId:crypto.randomUUID()};
    const failing=management({...mysqlRepository,withCategory:(id,work)=>mysqlRepository.withCategory(id,unit=>work({...unit,enqueueNotifications:async()=>{throw Error("Injected outbox failure");}}))});
    await expect(failing.createPublic(input)).rejects.toThrow();expect((await service.snapshot(f.categoryId)).reservations).toHaveLength(0);
    const [rows]:any=await c.execute("SELECT * FROM booking_submissions WHERE keyHash=?",[crypto.createHash("sha256").update(input.submissionId).digest("hex")]);expect(rows).toHaveLength(0);
    await service.createPublic(input);expect((await service.snapshot(f.categoryId)).reservations).toHaveLength(1);
  });
  it("stores new media privately, audits publication and verifies file integrity",async()=>{
    const upload=await storeMedia(pngFixture(),"image/png","fictional-technical-fixture.png","Technical upload fixture, not a hotel photograph",actorId);
    const [rows]:any=await c.execute("SELECT * FROM media_assets WHERE id=?",[upload.id]);const row={...rows[0],isPublished:Boolean(rows[0].isPublished)};expect(row.isPublished).toBe(false);expect(row.assetKey).toMatch(/^[a-f0-9-]+\.png$/);expect(await mediaFile(row)).toHaveProperty("mime","image/png");
    await publishMedia(upload.id,actorId,"Fictional local technical test only, no website placement");
    expect((await listManagedMedia()).find(r=>r.id===upload.id)?.isPublished).toBe(true);
    const video=await storeMedia(mp4Fixture(),"video/mp4","technical-container-fixture.mp4","Technical MP4 container fixture, not a hotel video",actorId);expect(video.id).toBeGreaterThan(0);
    const tamper=await storeMedia(pngFixture(),"image/png","integrity-fixture.png","Technical integrity fixture",actorId);const [tampered]:any=await c.execute("SELECT * FROM media_assets WHERE id=?",[tamper.id]);const file=await mediaFile(tampered[0]);await fs.promises.appendFile(file.file,Buffer.from([0]));await expect(mediaFile(tampered[0])).rejects.toThrow(/integrity/);
    await expect(storeMedia(Buffer.from("<script>"),"image/png","bad.png","Invalid upload test",actorId)).rejects.toThrow();
  });
  it('locks media placement revisions, rejects private assets and restores assignments through undo',async()=>{
    const before=await readMediaPlacements();
    const first=await storeMedia(pngFixture(),'image/png','phase10-integration-a.png','Synthetic integration fixture A, not hotel media',actorId);
    const second=await storeMedia(pngFixture(),'image/png','phase10-integration-b.png','Synthetic integration fixture B, not hotel media',actorId);
    await expect(saveMediaPlacement({target:'gallery',ids:[first.id],expectedRevision:before.revision,reason},actorId)).rejects.toMatchObject({code:'BAD_REQUEST'});
    expect(await readMediaPlacements()).toEqual(before);
    await publishMedia(first.id,actorId,reason);await publishMedia(second.id,actorId,reason);
    const results=await Promise.allSettled([first.id,second.id].map(id=>saveMediaPlacement({target:'gallery',ids:[id],expectedRevision:before.revision,reason},actorId)));
    expect(results.filter(r=>r.status==='fulfilled')).toHaveLength(1);
    const rejected=results.find(r=>r.status==='rejected') as PromiseRejectedResult;expect(rejected.reason).toMatchObject({code:'CONFLICT'});
    let state=await readMediaPlacements();
    await saveMediaPlacement({target:'gallery',ids:[second.id,first.id],expectedRevision:state.revision,reason},actorId);
    expect((await readPublicMedia()).gallery.map(r=>r.id)).toEqual([second.id,first.id]);
    state=await readMediaPlacements();await saveMediaPlacement({expectedRevision:state.revision,reason},actorId,true);
    state=await readMediaPlacements();await saveMediaPlacement({expectedRevision:state.revision,reason},actorId,true);
    expect((await readMediaPlacements()).assignments).toEqual(before.assignments);
    const [audit]:any=await c.execute("SELECT COUNT(*) AS n FROM audit_logs WHERE actorId=? AND action IN ('media.placement.save','media.placement.undo')",[actorId]);
    expect(Number(audit[0].n)).toBe(4);
    for(const user of [null,{id:actorId,role:'user'}]){
      const caller=appRouter.createCaller({user,req:{},res:{}} as any);
      await expect(caller.admin.mediaPlacements()).rejects.toMatchObject({code:user?'FORBIDDEN':'UNAUTHORIZED'});
    }
  });
  it("persists new category details, images, inventory and activation without a migration", async () => {
    const details = { slug: `p6-${crypto.randomUUID()}`, name: "Phase 6 fictional suite", description: "Local integration sample", maxOccupancy: 2, bedConfiguration: "Double", amenities: ["Desk", "Wi-Fi"], verification: "verified" as const, images: [{ url: "/hotel-media/fictional.webp", alt: "Fictional integration room" }], reason };
    const created = await createCategory(details, actorId);
    let d = await categories.detail(created.id);
    expect(d).toMatchObject({ isActive: false, sellableInventory: 0, name: details.name });
    // Category URLs are retained in drafts, but unapproved uploads must not be public.
    expect(d.images).toEqual(details.images);
    expect(await publicCategoryMedia(created.id)).toEqual([]);
    await expect(createCategory(details, actorId)).rejects.toThrow(/already exists/);
    await categories.inventory({ categoryId: created.id, expectedRevision: d.revision, sellableInventory: 2, reviewedCancellationIds: [], reconciliationAccepted: true, reason }, actorId);
    d = await categories.detail(created.id);
    await categories.save({ ...details, categoryId: created.id, expectedRevision: d.revision, name: "Updated Phase 6 fictional suite", isActive: true }, actorId);
    await service.execute({ categoryId: created.id, action: "rate.set", amount: "123.45", rateDate: null, reason }, actorId);
    const search = await service.search({ checkIn: day(1), checkOut: day(3), rooms: 1, adults: 2, children: 0, roomSlug: details.slug });
    expect(search.rooms[0]).toMatchObject({ name: "Updated Phase 6 fictional suite", maxOccupancy: 2, total: 246.9 });
    const publicCaller = appRouter.createCaller({ user: null, req: {}, res: {} } as any);
    const r = await publicCaller.booking.submit({ roomCategoryId: created.id, checkIn: day(1), checkOut: day(3), rooms: 1, adults: 2, children: 0, name: "Phase Six Fictional Guest", email: "phase6@example.invalid", phone: "0000000000", expectedTotal: "246.90" });
    expect(r).toMatchObject({ total: "246.90", amountPaid: "0.00", status: "pending manual confirmation" });
    const saved = (await service.snapshot(created.id)).reservations[0];
    d = await categories.detail(created.id);
    await expect(categories.save({ ...details, categoryId: created.id, expectedRevision: d.revision, maxOccupancy: 1, isActive: true }, actorId)).rejects.toThrow(/existing reservation/);
    await expect(categories.inventory({ categoryId: created.id, expectedRevision: d.revision, sellableInventory: 0, reviewedCancellationIds: [], reconciliationAccepted: true, reason }, actorId)).rejects.toThrow(/commitments/);
    await categories.save({ ...details, categoryId: created.id, expectedRevision: d.revision, isActive: false }, actorId);
    expect((await service.snapshot(created.id)).reservations[0]).toEqual(saved);
    expect((await service.history(created.id)).length).toBeGreaterThanOrEqual(5);
    expect((await service.search({ checkIn: day(1), checkOut: day(3), rooms: 1, adults: 1, children: 0, roomSlug: details.slug })).rooms).toHaveLength(0);
  });
  it("serializes capacity edits against concurrent public reservations", async () => {
    const f = await fixture(2), d = await categories.detail(f.categoryId);
    const results = await Promise.allSettled([
      categories.inventory({ categoryId: f.categoryId, expectedRevision: d.revision, sellableInventory: 1, reviewedCancellationIds: [], reconciliationAccepted: true, reason }, actorId),
      service.createPublic({ ...f.input, rooms: 2 }),
    ]);
    expect(results.filter(r => r.status === "fulfilled")).toHaveLength(1);
    const state = await service.snapshot(f.categoryId);
    expect(state.reservations.reduce((sum, r) => sum+r.rooms, 0)).toBeLessThanOrEqual(state.category.sellableInventory);
  });
  it("rolls back category details and images when audit persistence fails", async () => {
    const f = await fixture(), d = await categories.detail(f.categoryId);
    const failing = categoryAdministration({ ...mysqlRepository, withCategory: (id, work) => mysqlRepository.withCategory(id, unit => work({ ...unit, audit: async () => { throw new Error("Injected audit failure"); } })) });
    await expect(failing.save({ categoryId: f.categoryId, expectedRevision: d.revision, name: "Rollback fictional", description: "Rollback", maxOccupancy: 2, bedConfiguration: "Double", amenities: [], verification: "verified", images: [{ url: "/hotel-media/rollback.jpg", alt: "Rollback test" }], isActive: true, reason }, actorId)).rejects.toThrow();
    expect(await categories.detail(f.categoryId)).toEqual(d);
  });
  it("is ready with all operational tables using InnoDB", async () => {
    expect(await checkDatabaseReadiness()).toBe(true);
    const [rows]: any = await c.query("SELECT ENGINE AS engine FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE()");
    expect(rows).toHaveLength(28);
    expect(rows.every((row: any) => row.engine === "InnoDB")).toBe(true);
  });
  it("serializes competing reservations for the last room on real connections", async () => {
    const f = await fixture(1);
    const results = await Promise.allSettled([service.createPublic(f.input), service.createPublic(f.input)]);
    expect(results.filter(r => r.status === "fulfilled")).toHaveLength(1);
    expect(results.filter(r => r.status === "rejected")).toHaveLength(1);
    const s = await service.snapshot(f.categoryId);
    expect(s.reservations).toHaveLength(1);
    expect(s.guests).toHaveLength(1);
    expect(await stock(f.categoryId)).toBe(0);
    expect(await service.history(f.categoryId)).toHaveLength(1);
  });
  it("counts active holds and consumes a valid hold exactly once", async () => {
    const f = await fixture(1);
    const hold: any = await f.execute({ action: "hold.create", checkIn: day(1), checkOut: day(3), rooms: 1, minutes: 10 });
    await expect(service.createPublic(f.input)).rejects.toThrow(/inventory/i);
    await service.createPublic({ ...f.input, holdToken: hold.details.token });
    expect((await service.snapshot(f.categoryId)).bookingHolds[0].status).toBe("consumed");
    expect(await stock(f.categoryId)).toBe(0);
    await expect(service.createPublic({ ...f.input, holdToken: hold.details.token })).rejects.toThrow(/hold/i);
  });
  it("does not count expired holds and preserves cancellation inventory until approval", async () => {
    const f = await fixture(1);
    await c.execute("INSERT INTO booking_holds (token, roomCategoryId, checkIn, checkOut, rooms, expiresAt) VALUES (?, ?, ?, ?, 1, DATE_SUB(NOW(), INTERVAL 1 MINUTE))", [crypto.randomUUID(), f.categoryId, day(1), day(3)]);
    const r = await service.createPublic(f.input);
    await f.execute({ action: "reservation.status", reservationId: r.reservationId, expectedStatus: r.status, status: "cancellation requested" });
    expect(await stock(f.categoryId)).toBe(0);
    await f.execute({ action: "reservation.status", reservationId: r.reservationId, expectedStatus: "cancellation requested", status: "cancelled" });
    expect(await stock(f.categoryId)).toBe(1);
  });
  it("calculates nightly prices on the server and saves financial snapshots", async () => {
    const f = await fixture();
    await f.execute({ action: "rate.set", rateDate: day(2), amount: "150.25" });
    await service.createPublic({ ...f.input, rooms: 2, total: 1, subtotal: 1 } as any);
    const r = (await service.snapshot(f.categoryId)).reservations[0];
    expect(r.total).toBe("500.70");
    expect(r.outstanding).toBe("500.70");
    expect(r.nights).toBe(2);
    expect(JSON.parse(r.rateSnapshot).nightly.map((n: any) => n.amount)).toEqual(["100.10", "150.25"]);
    await f.execute({ action: "rate.set", rateDate: null, amount: "999.00" });
    expect((await service.snapshot(f.categoryId)).reservations[0].total).toBe("500.70");
  });
  it("prevents concurrent overlapping room assignments and permits adjacent stays", async () => {
    const f = await fixture(2);
    const a = await service.createPublic(f.input), b = await service.createPublic(f.input);
    const results = await Promise.allSettled([a, b].map(r => f.execute({ action: "room.assign", roomId: f.roomIds[0], reservationId: r.reservationId })));
    expect(results.filter(r => r.status === "fulfilled")).toHaveLength(1);
    const next = await service.createPublic({ ...f.input, checkIn: day(3), checkOut: day(4) });
    await f.execute({ action: "room.assign", roomId: f.roomIds[0], reservationId: next.reservationId });
    expect((await service.snapshot(f.categoryId)).roomAssignments).toHaveLength(2);
  });
  it("enforces housekeeping transitions, clean check-in and checkout cleaning", async () => {
    const f = await fixture(1);
    const r = await service.createPublic({ ...f.input, checkIn: day(0) });
    await f.execute({ action: "room.assign", roomId: f.roomIds[0], reservationId: r.reservationId });
    await f.execute({ action: "reservation.status", reservationId: r.reservationId, expectedStatus: r.status, status: "confirmed" });
    await f.execute({ action: "housekeeping.create", roomId: f.roomIds[0] });
    const taskId = (await service.snapshot(f.categoryId)).housekeepingTasks[0].id;
    await expect(f.execute({ action: "housekeeping.advance", taskId, status: "inspected" })).rejects.toThrow(/progress/i);
    await expect(f.execute({ action: "reservation.status", reservationId: r.reservationId, expectedStatus: "confirmed", status: "checked in" })).rejects.toThrow(/clean/i);
    for (const status of ["in progress", "completed", "inspected"]) await f.execute({ action: "housekeeping.advance", taskId, status });
    await f.execute({ action: "reservation.status", reservationId: r.reservationId, expectedStatus: "confirmed", status: "checked in" });
    await f.execute({ action: "reservation.status", reservationId: r.reservationId, expectedStatus: "checked in", status: "checked out" });
    const s = await service.snapshot(f.categoryId);
    expect(s.physicalRooms[0].housekeepingStatus).toBe("dirty");
    expect(s.roomAssignments[0].releasedAt).not.toBeNull();
    expect(s.housekeepingTasks.filter(t => t.status === "open")).toHaveLength(1);
  });
  it("serializes maintenance against booking, releases once, and requires cleaning", async () => {
    const f = await fixture(1);
    const race = await Promise.allSettled([
      f.execute({ action: "maintenance.create", roomId: f.roomIds[0], startDate: day(1), endDate: day(3) }),
      service.createPublic(f.input),
    ]);
    expect(race.filter(r => r.status === "fulfilled")).toHaveLength(1);
    expect(await stock(f.categoryId)).toBe(0);
    // A separate category makes release assertions independent of which racer won.
    const g = await fixture(1);
    await g.execute({ action: "maintenance.create", roomId: g.roomIds[0], startDate: day(1), endDate: day(3) });
    const maintenanceId = (await service.snapshot(g.categoryId)).roomMaintenance[0].id;
    expect(await stock(g.categoryId)).toBe(0);
    await g.execute({ action: "maintenance.release", maintenanceId });
    await expect(g.execute({ action: "maintenance.release", maintenanceId })).rejects.toThrow(/already/i);
    expect(await stock(g.categoryId)).toBe(1);
    const s = await service.snapshot(g.categoryId);
    expect(s.housekeepingTasks).toHaveLength(1);
    expect(s.physicalRooms[0].housekeepingStatus).toBe("dirty");
  });
  it("rolls back reservation, guest, hold and history writes if the audit fails", async () => {
    const f = await fixture(1);
    const hold: any = await f.execute({ action: "hold.create", checkIn: day(1), checkOut: day(3), rooms: 1, minutes: 10 });
    const before = await service.snapshot(f.categoryId);
    const repository: Repository = { ...mysqlRepository, withCategory: (id, work) => mysqlRepository.withCategory(id, unit => work({ ...unit, audit: async () => { throw new Error("Injected audit failure"); } })) };
    await expect(management(repository).createPublic({ ...f.input, holdToken: hold.details.token })).rejects.toThrow();
    const after = await service.snapshot(f.categoryId);
    expect(after.reservations).toHaveLength(0);
    expect(after.reservationStatusHistory).toHaveLength(0);
    expect(after.bookingHolds[0].status).toBe("active");
    expect(after.guests).toEqual(before.guests);
    // Orphan guests would not appear in category state, so check the table too.
    const [orphans]: any = await c.query("SELECT COUNT(*) AS count FROM guests g LEFT JOIN reservations r ON r.guestId = g.id WHERE r.id IS NULL");
    expect(Number(orphans[0].count)).toBe(0);
    expect(await service.history(f.categoryId)).toHaveLength(1);
  });
  it("denies anonymous and ordinary-user administrator calls with a real stored user", async () => {
    const f = await fixture();
    const [rows]: any = await c.execute("SELECT * FROM users WHERE id = ?", [actorId]);
    expect(rows[0].role).toBe("user");
    for (const user of [null, rows[0]]) {
      const caller = appRouter.createCaller({ req: {} as any, res: {} as any, user });
      const code = user ? "FORBIDDEN" : "UNAUTHORIZED";
      await expect(caller.operations.snapshot({ categoryId: f.categoryId })).rejects.toMatchObject({ code });
      await expect(caller.operations.execute({ action: "room.create", categoryId: f.categoryId, label: "DENIED", isActive: true })).rejects.toMatchObject({ code });
      await expect(caller.admin.summary()).rejects.toMatchObject({ code });
    }
    const [admins]: any = await c.query("SELECT COUNT(*) AS count FROM users WHERE role = 'admin'");
    expect(Number(admins[0].count)).toBe(0);
  });
  it("audits amendments on a newly created test booking and rejects stale revisions", async () => {
    const f = await fixture(2), r = await service.createPublic(f.input);
    const before = await service.snapshot(f.categoryId), revision = before.reservationRevisions[r.reservationId];
    const operation = { action: "reservation.amend", reservationId: r.reservationId, expectedRevision: revision, checkIn: day(1), checkOut: day(4), rooms: 1, adults: 1, children: 0 };
    await f.execute(operation);
    const after = await service.snapshot(f.categoryId);
    expect(after.reservations[0].total).toBe("300.30");
    expect(after.reservations[0].termsSnapshot).toBe(before.reservations[0].termsSnapshot);
    expect(after.reservations[0].amountPaid).toBe("0.00");
    expect(after.reservationAmendments).toHaveLength(1);
    expect(JSON.parse(after.reservationAmendments[0].beforeSnapshot).total).toBe("200.20");
    await expect(f.execute(operation)).rejects.toThrow(/changed/i);
  });
  it("requires cancellation review and explicit physical-capacity reconciliation", async () => {
    const f = await fixture(2), r = await service.createPublic(f.input);
    await f.execute({ action: "reservation.status", reservationId: r.reservationId, expectedStatus: r.status, status: "cancellation requested" });
    await expect(f.execute({ action: "inventory.reconcile", capacitySource: "physical", reviewedCancellationIds: [] })).rejects.toThrow(/review/i);
    await f.execute({ action: "inventory.reconcile", capacitySource: "physical", reviewedCancellationIds: [r.reservationId] });
    expect((await service.snapshot(f.categoryId)).effectiveCapacity).toBe(2);
    expect(await stock(f.categoryId)).toBe(1);
    await expect(f.execute({ action: "room.active", roomId: f.roomIds[0], isActive: false })).rejects.toThrow(/category capacity/i);
    expect((await service.snapshot(f.categoryId)).reservations[0].status).toBe("cancellation requested");
  });
});

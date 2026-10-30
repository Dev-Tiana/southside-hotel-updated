import { describe, expect, it } from "vitest";
import { management } from "./service";
import { available, peakUsage, quote, reservationRevision, type CategoryState, type Entity, type Insert, type Repository, type Row, type Unit } from "./domain";
import { dateKey, hotelToday, type NewReservation, type Operation } from "../../shared/operations";
import { operationalTables, supportedDatabase } from "./compatibility";
import { categoryAdministration, categoryRevision } from "./categories";
import { categoryCreate, categoryImage } from "../../shared/categories";

const now = new Date("2030-03-10T10:00:00Z");
const day = (value: string) => new Date(`${value}T00:00:00Z`);
const request: NewReservation = { roomCategoryId: 1, name: "Offline Guest", email: "offline@example.test", phone: "0000000000", checkIn: "2030-03-10", checkOut: "2030-03-12", rooms: 1, adults: 1, children: 0 };
const reservation = (overrides: Partial<Row<"reservations">> = {}): Row<"reservations"> => ({ id: 1, reference: "OFFLINE-1", guestId: 1, roomCategoryId: 1, checkIn: day(request.checkIn), checkOut: day(request.checkOut), rooms: 1, adults: 1, children: 0, nights: 2, status: "confirmed", source: "website", subtotal: "200.00", tax: "0.00", total: "200.00", amountPaid: "0.00", outstanding: "200.00", currency: "NGN", rateSnapshot: "original financial snapshot", termsSnapshot: "original agreed terms", createdAt: now, updatedAt: now, ...overrides });
function fixture(): CategoryState {
  return {
    category: { id: 1, slug: "offline", name: "Offline category", description: null, verification: "verified", maxOccupancy: 2, bedConfiguration: null, amenities: null, sellableInventory: 2, isActive: true, createdAt: now, updatedAt: now },
    policy: { id: 1, roomCategoryId: 1, capacitySource: "category", reconciledCapacity: 2, cancellationReconciledAt: now, reconciledBy: 1, reason: "Offline test review" },
    physicalRooms: [{ id: 1, roomCategoryId: 1, label: "Offline-101", isActive: true, housekeepingStatus: "dirty", createdAt: now }, { id: 2, roomCategoryId: 1, label: "Offline-102", isActive: true, housekeepingStatus: "clean", createdAt: now }],
    roomRates: [{ id: 1, roomCategoryId: 1, rateDate: null, amount: "100.00", currency: "NGN", isActive: true, createdAt: now }],
    reservations: [], guests: [], reservationStatusHistory: [], bookingHolds: [], inventoryBlocks: [], roomAssignments: [], housekeepingTasks: [], roomMaintenance: [], reservationAmendments: [],
  };
}

// Transactional in-memory double. Models category locks and rollback, not a
// substitute for real MySQL locking verification. No sockets or SQL are used.
class MemoryRepository implements Repository {
  state = fixture();
  audits: Array<{ action: string; actorId: number | null; details: unknown }> = [];
  writes: Array<{ entity: Entity; values: unknown }> = [];
  failAudit = false;
  approvedTerms = "Offline approved hotel terms";
  images: Array<{ url: string; alt: string }> = [];
  submissions: Record<string, { requestHash: string; reservationId: number }> = {};
  notificationIds: number[] = [];
  failNotifications = false;
  private tail: Promise<void> = Promise.resolve();
  private nextId = 100;
  async withCategory<T>(id: number, work: (unit: Unit) => Promise<T>) {
    if (id !== 1) throw new Error("Unknown test category");
    const previous = this.tail;
    let unlock!: () => void;
    this.tail = new Promise<void>(resolve => { unlock = resolve; });
    await previous;
    const state = structuredClone(this.state), audits = structuredClone(this.audits), writes = structuredClone(this.writes);
    let approvedTerms = this.approvedTerms;
    let images = structuredClone(this.images);
    const submissions = structuredClone(this.submissions), notificationIds = [...this.notificationIds];
    const rows = (entity: Entity): Array<{ id: number }> | undefined => (state as unknown as Record<string, Array<{ id: number }>>)[entity];
    const unit: Unit = {
      state,
      submission: async key => submissions[key],
      saveSubmission: async (key, requestHash, reservationId) => { if (submissions[key]) throw new Error("Duplicate submission"); submissions[key] = { requestHash, reservationId }; },
      enqueueNotifications: async id => { if (this.failNotifications) throw new Error("Offline outbox failure"); notificationIds.push(id); },
      categoryImages: async () => images,
      saveCategory: async (values, nextImages) => { Object.assign(state.category, values); if (nextImages) images = nextImages; },
      insert: async <K extends Entity>(entity: K, values: Insert<K>) => {
        const row = { id: this.nextId++, createdAt: now, updatedAt: now, releasedAt: null, status: entity === "housekeepingTasks" ? "open" : "active", housekeepingStatus: "dirty", ...values };
        if (entity === "inventoryPolicies") state.policy = row as Row<"inventoryPolicies">;
        else rows(entity)?.push(row);
        writes.push({ entity, values });
        return row.id;
      },
      update: async <K extends Entity>(entity: K, rowId: number, values: Partial<Insert<K>>) => {
        if (entity === "inventoryPolicies") state.policy = { ...state.policy!, ...values } as Row<"inventoryPolicies">;
        else {
          const collection = rows(entity)!;
          const index = collection.findIndex(row => row.id === rowId);
          if (index < 0) throw new Error("Missing test record");
          collection[index] = { ...collection[index], ...values };
        }
        writes.push({ entity, values });
      },
      audit: async (action, actorId, details) => { if (this.failAudit) throw new Error("Offline audit failure"); audits.push({ action, actorId, details }); },
      terms: async () => { if (!approvedTerms) throw new Error("No approved test terms"); return approvedTerms; },
      approveTerms: async terms => { approvedTerms = terms; },
      staffExists: async staffId => staffId === 1,
    };
    try {
      const result = await work(unit);
      this.state = state; this.audits = audits; this.writes = writes; this.approvedTerms = approvedTerms; this.images = images;
      this.submissions = submissions; this.notificationIds = notificationIds;
      return result;
    } finally { unlock(); }
  }
  async categoryIds() { return [1]; }
  async history() { return this.audits; }
}
const setup = () => { const repo = new MemoryRepository(); return { repo, service: management(repo, () => now) }; };
const command = (value: Record<string, unknown>) => ({ categoryId: 1, reason: "Offline operational review", ...value }) as Operation;

describe("category administration and reviewed public bookings", () => {
  it("deduplicates concurrent submissions and returns the current saved status",async()=>{
    const {repo,service}=setup();const input={...request,submissionId:"05a31484-759a-44ce-996b-190b92016b30"};
    const results=await Promise.all([service.createPublic(input),service.createPublic(input),service.createPublic(input)]);
    expect(new Set(results.map(r=>r.reference)).size).toBe(1);expect(repo.state.reservations).toHaveLength(1);expect(repo.state.guests).toHaveLength(1);expect(repo.notificationIds).toHaveLength(1);
    await expect(service.createPublic({...input,rooms:2})).rejects.toThrow(/different booking details/);
    repo.state.reservations[0].status="cancelled";repo.state.category.isActive=false;
    expect((await service.createPublic(input)).status).toBe("cancelled");
  });
  it("rolls back a booking, guest and identifier when the notification outbox fails",async()=>{
    const {repo,service}=setup();repo.failNotifications=true;const input={...request,submissionId:"05a31484-759a-44ce-996b-190b92016b30"};
    await expect(service.createPublic(input)).rejects.toThrow(/outbox/);expect(repo.state.reservations).toHaveLength(0);expect(repo.state.guests).toHaveLength(0);expect(Object.keys(repo.submissions)).toHaveLength(0);
    repo.failNotifications=false;await service.createPublic(input);expect(repo.state.reservations).toHaveLength(1);
  });
  function setupCategory() {
    const repo = new MemoryRepository();
    const service = categoryAdministration(repo, () => now);
    const edit = () => ({ categoryId: 1, expectedRevision: categoryRevision(repo.state.category, repo.images), name: "Updated offline category", description: "Fictional details", maxOccupancy: 2, bedConfiguration: "Double bed", amenities: ["Desk"], verification: "verified", images: [{ url: "/hotel-media/offline.webp", alt: "Offline room" }], isActive: true, reason: "Offline category test" });
    const inventory = (count: number, reviewedCancellationIds: number[] = []) => ({ categoryId: 1, expectedRevision: categoryRevision(repo.state.category, repo.images), sellableInventory: count, reviewedCancellationIds, reconciliationAccepted: true, reason: "Offline inventory review" });
    return { repo, service, edit, inventory };
  }
  it("validates slugs, occupancy, images and bounded details", () => {
    const { edit } = setupCategory();
    expect(categoryCreate.safeParse({ ...edit(), slug: "garden-suite" }).success).toBe(true);
    expect(categoryCreate.safeParse({ ...edit(), slug: "../bad", maxOccupancy: 0 }).success).toBe(false);
    for (const url of ["javascript:alert(1)", "https://outside.invalid/photo.jpg", "/hotel-media/../secret.jpg", "/hotel-media/x.svg"]) expect(categoryImage.safeParse({ url, alt: "Photo" }).success).toBe(false);
  });
  it("saves details and images atomically with before/after history, rejecting stale edits", async () => {
    const { repo, service, edit } = setupCategory(), input = edit();
    await service.save(input, 7);
    expect(repo.state.category.name).toBe(input.name);
    expect(repo.images).toEqual(input.images);
    expect(repo.audits[0]).toMatchObject({ action: "category.update", actorId: 7 });
    await expect(service.save(input, 7)).rejects.toThrow(/changed/);
    repo.failAudit = true;
    await expect(service.save({ ...edit(), name: "Should roll back" }, 7)).rejects.toThrow(/audit/);
    expect(repo.state.category.name).toBe(input.name);
  });
  it("does not change reservation snapshots and refuses occupancy below commitments", async () => {
    const { repo, service, edit } = setupCategory();
    repo.state.reservations = [reservation({ adults: 2 })];
    const before = structuredClone(repo.state.reservations);
    await expect(service.save({ ...edit(), maxOccupancy: 1 }, 7)).rejects.toThrow(/existing reservation/);
    await service.save({ ...edit(), isActive: false }, 7);
    expect(repo.state.reservations).toEqual(before);
    expect(repo.state.category.isActive).toBe(false);
  });
  it("requires cancellation review and never shrinks below commitments", async () => {
    const { repo, service, inventory } = setupCategory();
    repo.state.reservations = [reservation({ status: "cancellation requested" })];
    await expect(service.inventory(inventory(2), 7)).rejects.toThrow(/Review/);
    await expect(service.inventory(inventory(0, [1]), 7)).rejects.toThrow(/commitments/);
    await service.inventory(inventory(1, [1]), 7);
    expect(repo.state.category.sellableInventory).toBe(1);
    expect(repo.state.policy?.reconciledCapacity).toBe(1);
    expect(repo.audits[0].action).toBe("category.inventory");
  });
  it("preserves physical authority and counts active holds and maintenance", async () => {
    const { repo, service, inventory } = setupCategory();
    repo.state.policy!.capacitySource = "physical";
    await expect(service.inventory(inventory(3), 7)).rejects.toThrow(/Physical/);
    repo.state.policy!.capacitySource = "category";
    repo.state.bookingHolds = [{ id: 1, token: "offline-active", roomCategoryId: 1, checkIn: day(request.checkIn), checkOut: day(request.checkOut), rooms: 1, status: "active", expiresAt: new Date(now.getTime()+60000), createdAt: now }];
    repo.state.inventoryBlocks = [{ id: 1, roomCategoryId: 1, startDate: day(request.checkIn), endDate: day(request.checkOut), quantity: 1, reason: "Maintenance", releasedAt: null, createdBy: 1, createdAt: now }];
    await expect(service.inventory(inventory(1), 7)).rejects.toThrow(/commitments/);
  });
  it("rejects changed reviewed totals and terms before inserting a guest", async () => {
    const { repo, service } = setup();
    await expect(service.createPublic({ ...request, expectedTotal: "1.00" })).rejects.toThrow(/price changed/);
    await expect(service.createPublic({ ...request, expectedTerms: "Different reviewed terms" })).rejects.toThrow(/terms changed/);
    expect(repo.state.guests).toHaveLength(0);
    const result = await service.createPublic({ ...request, expectedTotal: "200.00", expectedTerms: repo.approvedTerms });
    expect(result).toMatchObject({ total: "200.00", amountPaid: "0.00", status: "pending manual confirmation" });
  });
});

describe("inventory and reconciliation", () => {
  it("uses per-night occupancy rather than summing non-overlapping bookings", () => {
    const s = fixture();
    s.reservations = [reservation({ checkOut: day("2030-03-11") }), reservation({ id: 2, checkIn: day("2030-03-11") })];
    expect(available(s, request.checkIn, request.checkOut, now)).toBe(1);
  });
  it("counts reservations, live holds, maintenance and cancellation requests once", () => {
    const s = fixture(); s.category.sellableInventory = 8;
    s.reservations = [reservation(), reservation({ id: 2, status: "cancellation requested" }), reservation({ id: 3, status: "cancelled" })];
    s.bookingHolds = [{ id: 1, token: "offline-live-hold", roomCategoryId: 1, checkIn: day(request.checkIn), checkOut: day(request.checkOut), rooms: 1, expiresAt: new Date(now.getTime() + 60000), status: "active", createdAt: now }, { id: 2, token: "offline-expired", roomCategoryId: 1, checkIn: day(request.checkIn), checkOut: day(request.checkOut), rooms: 3, expiresAt: new Date(now.getTime() - 1), status: "active", createdAt: now }];
    s.inventoryBlocks = [{ id: 1, roomCategoryId: 1, startDate: day(request.checkIn), endDate: day(request.checkOut), quantity: 1, reason: "Offline maintenance", releasedAt: null, createdBy: 1, createdAt: now }];
    s.roomAssignments = [{ id: 1, roomId: 1, reservationId: 1, assignedBy: 1, releasedAt: null, createdAt: now }];
    expect(available(s, request.checkIn, request.checkOut, now)).toBe(4);
    s.inventoryBlocks[0].releasedAt = now;
    expect(available(s, request.checkIn, request.checkOut, now)).toBe(5);
  });
  it("gates bookings until historical cancellation requests are reviewed", async () => {
    const { repo, service } = setup(); repo.state.policy = undefined;
    repo.state.reservations = [reservation({ status: "cancellation requested" })];
    await expect(service.createPublic(request)).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    await expect(service.execute(command({ action: "inventory.reconcile", capacitySource: "category", reviewedCancellationIds: [] }), 1)).rejects.toMatchObject({ code: "CONFLICT" });
    await service.execute(command({ action: "inventory.reconcile", capacitySource: "category", reviewedCancellationIds: [1] }), 1);
    expect(repo.state.reservations[0].status).toBe("cancellation requested");
    expect(repo.state.reservations[0].rateSnapshot).toBe("original financial snapshot");
    await service.createPublic(request);
    expect(repo.state.reservations).toHaveLength(2);
  });
  it("rejects physical capacity below any future commitment", async () => {
    const { repo, service } = setup(); repo.state.physicalRooms.pop();
    repo.state.reservations = [reservation({ rooms: 2, checkIn: day("2035-01-01"), checkOut: day("2035-01-02") })];
    expect(peakUsage(repo.state, now)).toBe(2);
    await expect(service.execute(command({ action: "inventory.reconcile", capacitySource: "physical", reviewedCancellationIds: [] }), 1)).rejects.toMatchObject({ code: "CONFLICT" });
    expect(repo.state.policy?.capacitySource).toBe("category");
  });
  it("never replaces category capacity just because physical rooms were entered", async () => {
    const { repo, service } = setup(); repo.state.category.sellableInventory = 5;
    await service.execute(command({ action: "room.create", label: "Offline-103", isActive: true }), 1);
    expect((await service.snapshot(1)).effectiveCapacity).toBe(5);
    await service.execute(command({ action: "inventory.reconcile", capacitySource: "physical", reviewedCancellationIds: [] }), 1);
    expect((await service.snapshot(1)).effectiveCapacity).toBe(3);
    expect(repo.state.category.sellableInventory).toBe(5);
    await expect(service.execute(command({ action: "room.active", roomId: 1, isActive: false }), 1)).rejects.toMatchObject({ code: "CONFLICT" });
  });
  it("serializes two concurrent requests for the last room", async () => {
    const { repo, service } = setup(); repo.state.category.sellableInventory = 1;
    const results = await Promise.allSettled([service.createPublic(request), service.createPublic(request)]);
    expect(results.filter(result => result.status === "fulfilled")).toHaveLength(1);
    expect(repo.state.reservations).toHaveLength(1);
    expect(repo.audits).toHaveLength(1);
  });
  it("serializes a competing hold and reservation", async () => {
    const { repo, service } = setup(); repo.state.category.sellableInventory = 1;
    const results = await Promise.allSettled([service.execute(command({ action: "hold.create", checkIn: request.checkIn, checkOut: request.checkOut, rooms: 1, minutes: 10 }), 1), service.createPublic(request)]);
    expect(results.filter(result => result.status === "fulfilled")).toHaveLength(1);
    expect(repo.state.reservations.length + repo.state.bookingHolds.length).toBe(1);
  });
  it.each([true, false])("serializes maintenance and a last-room booking (maintenance first: %s)", async maintenanceFirst => {
    const { repo, service } = setup(); repo.state.category.sellableInventory = 1;
    const maintenance = () => service.execute(command({ action: "maintenance.create", roomId: 1, startDate: request.checkIn, endDate: request.checkOut }), 1);
    const booking = () => service.createPublic(request);
    const results = await Promise.allSettled(maintenanceFirst ? [maintenance(), booking()] : [booking(), maintenance()]);
    expect(results.filter(result => result.status === "fulfilled")).toHaveLength(1);
    expect(repo.state.reservations.length + repo.state.inventoryBlocks.length).toBe(1);
  });
  it("consumes a valid hold atomically rather than double counting it", async () => {
    const { repo, service } = setup(); repo.state.category.sellableInventory = 1;
    await service.execute(command({ action: "hold.create", checkIn: request.checkIn, checkOut: request.checkOut, rooms: 1, minutes: 10 }), 1);
    await service.createPublic({ ...request, holdToken: repo.state.bookingHolds[0].token });
    expect(repo.state.bookingHolds[0].status).toBe("consumed");
    expect(available(repo.state, request.checkIn, request.checkOut, now)).toBe(0);
  });
  it("rolls back inventory and reservation writes if audit recording fails", async () => {
    const { repo, service } = setup(); repo.failAudit = true;
    await expect(service.createPublic(request)).rejects.toThrow("Offline audit failure");
    expect(repo.state.reservations).toHaveLength(0); expect(repo.writes).toHaveLength(0);
  });
  it("keeps reconciliation tools visible if physical counts drift", async () => {
    const { repo, service } = setup(); repo.state.policy!.capacitySource = "physical";
    repo.state.physicalRooms.pop();
    const snapshot = await service.snapshot(1);
    expect(snapshot.effectiveCapacity).toBeNull(); expect(snapshot.reconciliationRequired).toBe(true);
    expect(snapshot.physicalRooms).toHaveLength(1);
    await expect(service.createPublic(request)).rejects.toThrow("Physical inventory changed");
  });
  it("does not guess extended dates or prices for unresolved checked-in stays", async () => {
    const { repo, service } = setup();
    repo.state.reservations = [reservation({ status: "checked in", checkIn: day("2030-03-08"), checkOut: day("2030-03-10") })];
    await expect(service.createPublic(request)).rejects.toThrow("passed its departure date");
    expect(repo.state.reservations[0].total).toBe("200.00");
    expect(dateKey(repo.state.reservations[0].checkOut)).toBe("2030-03-10");
    await service.execute(command({ action: "reservation.status", reservationId: 1, expectedStatus: "checked in", status: "checked out" }), 1);
    await service.createPublic(request);
    expect(repo.state.reservations).toHaveLength(2);
  });
});

describe("server pricing and amendments", () => {
  it("uses nightly overrides, exact cents, and room quantity", () => {
    const s = fixture(); s.roomRates[0].amount = "100.10";
    s.roomRates.push({ ...s.roomRates[0], id: 2, rateDate: day("2030-03-11"), amount: "200.20" });
    expect(quote(s, request.checkIn, request.checkOut, 2).total).toBe("600.60");
  });
  it("ignores browser financial snapshots and totals for new reservations", async () => {
    const { repo, service } = setup();
    await service.createPublic({ ...request, subtotal: 1, total: 1, rateSnapshot: "untrusted", termsSnapshot: "untrusted" } as NewReservation);
    const row = repo.state.reservations[0];
    expect(row.total).toBe("200.00"); expect(row.termsSnapshot).toBe("Offline approved hotel terms");
    expect(row.rateSnapshot).not.toBe("untrusted");
  });
  it("fails closed for missing or ambiguous rates", () => {
    const s = fixture(); s.roomRates.push({ ...s.roomRates[0], id: 2 });
    expect(() => quote(s, request.checkIn, request.checkOut, 1)).toThrow("Rates are missing or ambiguous");
    s.roomRates = [];
    expect(() => quote(s, request.checkIn, request.checkOut, 1)).toThrow("Rates are missing or ambiguous");
  });
  it("changes rates without repricing existing reservations", async () => {
    const { repo, service } = setup(); repo.state.reservations = [reservation()];
    const before = structuredClone(repo.state.reservations[0]);
    await service.execute(command({ action: "rate.set", rateDate: null, amount: "300.50" }), 1);
    expect(repo.state.reservations[0]).toEqual(before);
    expect(repo.state.roomRates[0].isActive).toBe(false);
    expect(quote(repo.state, request.checkIn, request.checkOut, 1).total).toBe("601.00");
  });
  it("preserves paid amounts and agreed terms in explicitly audited amendments", async () => {
    const { repo, service } = setup(); repo.state.reservations = [reservation({ amountPaid: "50.00" })];
    await service.execute(command({ action: "reservation.amend", reservationId: 1, expectedRevision: reservationRevision(repo.state.reservations[0]), checkIn: request.checkIn, checkOut: "2030-03-13", rooms: 1, adults: 1, children: 0 }), 1);
    const row = repo.state.reservations[0];
    expect(row.total).toBe("300.00"); expect(row.amountPaid).toBe("50.00"); expect(row.outstanding).toBe("250.00");
    expect(row.termsSnapshot).toBe("original agreed terms");
    expect(JSON.parse(repo.state.reservationAmendments[0].beforeSnapshot).total).toBe("200.00");
    expect(repo.audits.at(-1)?.action).toBe("reservation.amend");
  });
  it("rejects amendments requiring refunds, stale amendments, and reversed dates", async () => {
    const { repo, service } = setup(); repo.state.reservations = [reservation({ amountPaid: "200.00" })];
    const amend = command({ action: "reservation.amend", reservationId: 1, expectedRevision: reservationRevision(repo.state.reservations[0]), checkIn: request.checkIn, checkOut: "2030-03-11", rooms: 1, adults: 1, children: 0 });
    await expect(service.execute(amend, 1)).rejects.toThrow("require a refund");
    await expect(service.execute({ ...amend, expectedRevision: "a".repeat(64) } as Operation, 1)).rejects.toThrow("reservation changed");
    await expect(service.createPublic({ ...request, checkOut: "2030-03-09" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(repo.state.reservationAmendments).toHaveLength(0);
  });
  it("rejects concurrent amendments based on the same old revision", async () => {
    const { repo, service } = setup(); repo.state.reservations = [reservation()];
    const amend = command({ action: "reservation.amend", reservationId: 1, expectedRevision: reservationRevision(repo.state.reservations[0]), checkIn: request.checkIn, checkOut: "2030-03-13", rooms: 1, adults: 1, children: 0 });
    const results = await Promise.allSettled([service.execute(amend, 1), service.execute(amend, 1)]);
    expect(results.filter(result => result.status === "fulfilled")).toHaveLength(1);
    expect(repo.state.reservationAmendments).toHaveLength(1);
  });
  it("rejects money overflow, zero rates, missing terms, and excess occupancy", async () => {
    const { repo, service } = setup();
    await expect(service.execute(command({ action: "rate.set", rateDate: null, amount: "0.00" }), 1)).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(service.execute(command({ action: "rate.set", rateDate: null, amount: "10000000000" }), 1)).rejects.toMatchObject({ name: "ZodError" });
    const overflow = fixture(); overflow.roomRates[0].amount = "9999999999.99";
    expect(() => quote(overflow, request.checkIn, request.checkOut, 1)).toThrow("supported limit");
    await expect(service.createPublic({ ...request, adults: 3 })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    repo.approvedTerms = "";
    await expect(service.createPublic(request)).rejects.toThrow("No approved test terms");
    expect(repo.state.reservations).toHaveLength(0);
  });
});

describe("physical rooms, maintenance, and housekeeping", () => {
  it("prevents concurrent conflicting physical room assignments", async () => {
    const { repo, service } = setup(); repo.state.reservations = [reservation(), reservation({ id: 2 })];
    const results = await Promise.allSettled([1, 2].map(reservationId => service.execute(command({ action: "room.assign", roomId: 1, reservationId }), 1)));
    expect(results.filter(result => result.status === "fulfilled")).toHaveLength(1);
    expect(repo.state.roomAssignments).toHaveLength(1);
    expect(available(repo.state, request.checkIn, request.checkOut, now)).toBe(0);
  });
  it("rejects cross-category IDs and over-assignment", async () => {
    const { repo, service } = setup(); repo.state.reservations = [reservation()];
    await expect(service.execute(command({ action: "room.assign", roomId: 999, reservationId: 1 }), 1)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await service.execute(command({ action: "room.assign", roomId: 1, reservationId: 1 }), 1);
    await expect(service.execute(command({ action: "room.assign", roomId: 2, reservationId: 1 }), 1)).rejects.toThrow("requested number");
  });
  it("allows back-to-back assignments on the departure boundary", async () => {
    const { repo, service } = setup();
    repo.state.reservations = [reservation(), reservation({ id: 2, checkIn: day("2030-03-12"), checkOut: day("2030-03-14") })];
    for (const reservationId of [1, 2]) await service.execute(command({ action: "room.assign", roomId: 1, reservationId }), 1);
    expect(repo.state.roomAssignments).toHaveLength(2);
  });
  it("blocks maintenance from displacing an assigned room or a full category", async () => {
    const { repo, service } = setup(); repo.state.reservations = [reservation()];
    await service.execute(command({ action: "room.assign", roomId: 1, reservationId: 1 }), 1);
    const maintenance = command({ action: "maintenance.create", roomId: 1, startDate: request.checkIn, endDate: request.checkOut });
    await expect(service.execute(maintenance, 1)).rejects.toThrow("overlapping assignment");
    repo.state.category.sellableInventory = 1;
    await expect(service.execute({ ...maintenance, roomId: 2 } as Operation, 1)).rejects.toThrow("displace");
  });
  it("counts a maintenance job once, blocks assignment, and retains released history", async () => {
    const { repo, service } = setup();
    await service.execute(command({ action: "maintenance.create", roomId: 1, startDate: request.checkIn, endDate: request.checkOut }), 1);
    expect(available(repo.state, request.checkIn, request.checkOut, now)).toBe(1);
    repo.state.reservations = [reservation()];
    await expect(service.execute(command({ action: "room.assign", roomId: 1, reservationId: 1 }), 1)).rejects.toThrow("maintenance");
    await service.execute(command({ action: "maintenance.release", maintenanceId: repo.state.roomMaintenance[0].id }), 1);
    expect(repo.state.inventoryBlocks).toHaveLength(1);
    expect(repo.state.inventoryBlocks[0].releasedAt).toEqual(now);
    expect(repo.state.physicalRooms[0].housekeepingStatus).toBe("dirty");
    expect(repo.state.housekeepingTasks[0].status).toBe("open");
  });
  it("requires ordered cleaning and inspection transitions", async () => {
    const { repo, service } = setup();
    await service.execute(command({ action: "housekeeping.create", roomId: 1 }), 1);
    const taskId = repo.state.housekeepingTasks[0].id;
    await expect(service.execute(command({ action: "housekeeping.advance", taskId, status: "inspected" }), 1)).rejects.toMatchObject({ code: "CONFLICT" });
    for (const status of ["in progress", "completed", "inspected"]) await service.execute(command({ action: "housekeeping.advance", taskId, status }), 1);
    expect(repo.state.physicalRooms[0].housekeepingStatus).toBe("inspected");
    expect(repo.audits).toHaveLength(4);
  });
  it("rejects nonexistent staff and duplicate pending cleaning tasks", async () => {
    const { repo, service } = setup();
    await expect(service.execute(command({ action: "housekeeping.create", roomId: 1, assignedTo: 999 }), 1)).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await service.execute(command({ action: "housekeeping.create", roomId: 1 }), 1);
    await expect(service.execute(command({ action: "housekeeping.create", roomId: 1 }), 1)).rejects.toMatchObject({ code: "CONFLICT" });
    expect(repo.state.housekeepingTasks).toHaveLength(1);
  });
  it("releases legacy category blocks without deleting or changing their original details", async () => {
    const { repo, service } = setup();
    const original = { id: 1, roomCategoryId: 1, startDate: day(request.checkIn), endDate: day(request.checkOut), quantity: 1, reason: "Original offline block", releasedAt: null, createdBy: 1, createdAt: now };
    repo.state.inventoryBlocks = [original];
    await service.execute(command({ action: "maintenance.releaseBlock", blockId: 1 }), 1);
    expect(repo.state.inventoryBlocks[0]).toEqual({ ...original, releasedAt: now });
    expect(repo.audits.at(-1)?.action).toBe("maintenance.releaseBlock");
  });
  it("requires assigned rooms to be clean at check-in and dirties them at checkout", async () => {
    const { repo, service } = setup(); repo.state.reservations = [reservation()];
    await service.execute(command({ action: "room.assign", roomId: 1, reservationId: 1 }), 1);
    const checkin = command({ action: "reservation.status", reservationId: 1, expectedStatus: "confirmed", status: "checked in" });
    await expect(service.execute(checkin, 1)).rejects.toThrow("Clean the assigned rooms");
    repo.state.physicalRooms[0].housekeepingStatus = "clean";
    await service.execute(checkin, 1);
    await expect(service.execute(command({ action: "room.release", assignmentId: repo.state.roomAssignments[0].id }), 1)).rejects.toThrow("occupied room");
    await service.execute(command({ action: "reservation.status", reservationId: 1, expectedStatus: "checked in", status: "checked out" }), 1);
    expect(repo.state.roomAssignments[0].releasedAt).toEqual(now);
    expect(repo.state.physicalRooms[0].housekeepingStatus).toBe("dirty");
    expect(repo.state.housekeepingTasks[0].status).toBe("open");
  });
  it("retains inventory for requested cancellations until approved", async () => {
    const { repo, service } = setup(); repo.state.reservations = [reservation()];
    await service.execute(command({ action: "reservation.status", reservationId: 1, expectedStatus: "confirmed", status: "cancellation requested" }), 1);
    expect(available(repo.state, request.checkIn, request.checkOut, now)).toBe(1);
    await service.execute(command({ action: "reservation.status", reservationId: 1, expectedStatus: "cancellation requested", status: "cancelled" }), 1);
    expect(available(repo.state, request.checkIn, request.checkOut, now)).toBe(2);
    expect(repo.state.reservations[0].total).toBe("200.00");
  });
});

describe("compatibility and boundaries", () => {
  const engines = operationalTables.map(name => ({ name, engine: "InnoDB" }));
  it("accepts MySQL 8+ InnoDB and rejects unverified/mixed engines", () => {
    expect(supportedDatabase("8.0.36", engines)).toBe(true);
    expect(supportedDatabase("9.1.0", engines)).toBe(true);
    expect(supportedDatabase("5.7.44", engines)).toBe(false);
    expect(supportedDatabase("10.11.0-MariaDB", engines)).toBe(false);
    expect(supportedDatabase("8.0.36", engines.slice(1))).toBe(false);
    expect(supportedDatabase("8.0.36", [{ name: "reservations", engine: "MyISAM" }, ...engines.filter(row => row.name !== "reservations")])).toBe(false);
  });
  it("uses Lagos date boundaries and exclusive departure dates", () => {
    expect(hotelToday(new Date("2030-03-09T23:30:00Z"))).toBe("2030-03-10");
    const s = fixture(); s.reservations = [reservation({ checkOut: day("2030-03-11") })];
    expect(available(s, "2030-03-11", "2030-03-12", now)).toBe(2);
    expect(dateKey(s.reservations[0].checkIn)).toBe(request.checkIn);
  });
});

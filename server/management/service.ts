import { nanoid } from "nanoid";
import { createHash } from "node:crypto";
import { bookingIntent } from "../../shared/submission";
import { dateKey, hotelToday, newReservationInput, operationInput, type NewReservation, type Operation } from "../../shared/operations";
import { available, assertRoomFree, capacity, cents, consumingStatuses, findRow, money, peakUsage, quote, reject, requireReady, reservationRevision, validateStay, type Repository, type Unit } from "./domain";
import { mysqlRepository } from "./repository";

const asDate = (value: string) => new Date(`${value}T00:00:00.000Z`);
const transitions: Record<string, string[]> = {
  draft: ["pending manual confirmation", "cancelled"],
  "pending manual confirmation": ["confirmed", "cancellation requested", "cancelled"],
  "pending payment": ["pending manual confirmation", "confirmed", "cancellation requested", "cancelled", "expired", "payment failed"],
  confirmed: ["checked in", "cancellation requested", "cancelled"],
  "cancellation requested": ["cancelled", "confirmed"],
  "checked in": ["checked out"],
};

export function management(repository: Repository = mysqlRepository, clock = () => new Date()) {
  async function create(unit: Unit, input: NewReservation, actorId: number | null, source: "website" | "staff" | "walk in" | "telephone" | "whatsapp", reason: string) {
    const state = unit.state, now = clock();
    const keyHash = input.submissionId ? createHash("sha256").update(input.submissionId.toLowerCase()).digest("hex") : undefined;
    const requestHash = createHash("sha256").update(bookingIntent(input)).digest("hex");
    if (keyHash) {
      const saved = await unit.submission(keyHash);
      if (saved) {
        if (saved.requestHash !== requestHash) reject("This submission identifier belongs to different booking details. Review the original request before starting a new reservation.");
        const reservation = state.reservations.find(r => r.id === saved.reservationId);
        if (!reservation) reject("This submission identifier belongs to another category. Use the original booking details.");
        return { reservationId: reservation.id, reference: reservation.reference, status: reservation.status, total: reservation.total, currency: reservation.currency, amountPaid: reservation.amountPaid, nights: reservation.nights };
      }
    }
    validateStay(input.checkIn, input.checkOut, now);
    requireReady(state, now);
    if (!state.category.isActive) reject("This category is not open for booking.");
    if (state.category.maxOccupancy === null || input.adults + input.children > state.category.maxOccupancy * input.rooms) reject("The guest count exceeds the configured room occupancy.", "BAD_REQUEST");
    let hold;
    if (input.holdToken) {
      hold = state.bookingHolds.find(row => row.token === input.holdToken);
      if (!hold || hold.status !== "active" || new Date(hold.expiresAt) <= now || dateKey(hold.checkIn) !== input.checkIn || dateKey(hold.checkOut) !== input.checkOut || hold.rooms !== input.rooms) reject("The booking hold is invalid or expired.");
    }
    if (available(state, input.checkIn, input.checkOut, now, undefined, input.holdToken) < input.rooms) reject("The selected inventory changed. Search again before submitting.");
    const price = quote(state, input.checkIn, input.checkOut, input.rooms);
    if (input.expectedTotal !== undefined && input.expectedTotal !== price.total) reject("The price changed. Search again and review the new total before submitting.");
    const termsSnapshot = await unit.terms();
    if (input.expectedTerms !== undefined && input.expectedTerms !== termsSnapshot) reject("Booking terms changed. Reload and review the current terms before submitting.");
    const guestId = await unit.insert("guests", { name: input.name, email: input.email, phone: input.phone });
    const reference = `SS${nanoid(10).toUpperCase()}`;
    const reservationId = await unit.insert("reservations", {
      reference, guestId, roomCategoryId: state.category.id, checkIn: asDate(input.checkIn), checkOut: asDate(input.checkOut),
      adults: input.adults, children: input.children, rooms: input.rooms, ...price, termsSnapshot,
      status: "pending manual confirmation", source, amountPaid: "0.00", outstanding: price.total,
    });
    if (hold) await unit.update("bookingHolds", hold.id, { status: "consumed" });
    await unit.insert("reservationStatusHistory", { reservationId, fromStatus: null, toStatus: "pending manual confirmation", actorType: actorId === null ? "guest" : "staff", actorId, note: reason });
    await unit.audit("reservation.create", actorId, { reservationId, reference, source, price, reason, consumedHoldId: hold?.id });
    if (keyHash) await unit.saveSubmission(keyHash, requestHash, reservationId);
    await unit.enqueueNotifications(reservationId);
    return { reservationId, reference, status: "pending manual confirmation" as const, total: price.total, currency: price.currency, amountPaid: "0.00", nights: price.nights };
  }

  async function task(unit: Unit, roomId: number, actorId: number, reason: string, assignedTo?: number) {
    findRow(unit.state, "physicalRooms", roomId);
    if (unit.state.housekeepingTasks.some(row => row.roomId === roomId && row.status !== "inspected")) reject("Complete the existing housekeeping task first.");
    if (assignedTo && !await unit.staffExists(assignedTo)) reject("The assigned staff account does not exist.", "BAD_REQUEST");
    const id = await unit.insert("housekeepingTasks", { roomId, assignedTo: assignedTo ?? actorId, note: reason });
    await unit.update("physicalRooms", roomId, { housekeepingStatus: "dirty" });
    return id;
  }

  async function requireCleaning(unit: Unit, roomId: number, actorId: number, note: string) {
    const room = findRow(unit.state, "physicalRooms", roomId);
    const existing = unit.state.housekeepingTasks.find(row => row.roomId === roomId && row.status !== "inspected");
    await unit.update("physicalRooms", roomId, { housekeepingStatus: "dirty" });
    if (existing) await unit.update("housekeepingTasks", existing.id, { status: "open" });
    const taskId = existing?.id ?? await unit.insert("housekeepingTasks", { roomId, status: "open", assignedTo: actorId, note });
    return { roomId, taskId, previousRoomStatus: room.housekeepingStatus, previousTaskStatus: existing?.status ?? null, status: "open" };
  }

  async function execute(raw: Operation, actorId: number) {
    const input = operationInput.parse(raw);
    return repository.withCategory(input.categoryId, async unit => {
      const s = unit.state, now = clock();
      const finish = async (details: unknown) => {
        await unit.audit(input.action, actorId, { reason: "reason" in input ? input.reason : "Physical room added", details });
        return { message: "Operation saved.", details };
      };
      switch (input.action) {
        case "inventory.reconcile": {
          const actual = s.reservations.filter(row => row.status === "cancellation requested").map(row => row.id).sort((a, b) => a - b);
          const reviewed = [...new Set(input.reviewedCancellationIds)].sort((a, b) => a - b);
          if (JSON.stringify(actual) !== JSON.stringify(reviewed)) reject("Review every current cancellation request before reconciliation.");
          const count = input.capacitySource === "physical" ? s.physicalRooms.filter(row => row.isActive).length : s.category.sellableInventory;
          if (!Number.isInteger(count) || count < 0 || count < peakUsage(s, now)) reject("Capacity would be below existing commitments. Resolve conflicts explicitly before reconciliation.");
          const values = { roomCategoryId: input.categoryId, capacitySource: input.capacitySource, reconciledCapacity: count, cancellationReconciledAt: now, reconciledBy: actorId, reason: input.reason };
          if (s.policy) await unit.update("inventoryPolicies", s.policy.id, values);
          else await unit.insert("inventoryPolicies", values);
          return finish({ before: s.policy ?? null, after: values, reviewedCancellationIds: actual });
        }
        case "terms.approve":
          await unit.approveTerms(input.terms, actorId);
          return finish({ approvedTerms: input.terms });
        case "room.create": {
          if (s.policy?.capacitySource === "physical" && input.isActive) reject("Switch to category capacity before changing active physical inventory, then reconcile again.");
          if (s.physicalRooms.some(row => row.label === input.label)) reject("That physical room label already exists.");
          const roomId = await unit.insert("physicalRooms", { roomCategoryId: input.categoryId, label: input.label, isActive: input.isActive });
          return finish({ roomId, label: input.label, isActive: input.isActive });
        }
        case "room.active": {
          const room = findRow(s, "physicalRooms", input.roomId);
          if (s.policy?.capacitySource === "physical") reject("Switch to category capacity before changing active physical inventory, then reconcile again.");
          if (!input.isActive && s.roomAssignments.some(a => a.roomId === room.id && !a.releasedAt && consumingStatuses.has(findRow(s, "reservations", a.reservationId).status))) reject("Release the room's active assignments before deactivating it.");
          await unit.update("physicalRooms", room.id, { isActive: input.isActive });
          return finish({ before: room, after: { isActive: input.isActive } });
        }
        case "rate.set": {
          const amount = money(cents(input.amount));
          if (cents(amount) <= 0n) reject("Rates must be greater than zero.", "BAD_REQUEST");
          const replaced = s.roomRates.filter(rate => rate.isActive && (rate.rateDate ? dateKey(rate.rateDate) : null) === input.rateDate);
          for (const rate of replaced) await unit.update("roomRates", rate.id, { isActive: false });
          const rateId = await unit.insert("roomRates", { roomCategoryId: input.categoryId, rateDate: input.rateDate ? asDate(input.rateDate) : null, amount, currency: "NGN", isActive: true });
          return finish({ rateId, amount, rateDate: input.rateDate, replaced });
        }
        case "room.assign": {
          requireReady(s, now);
          const reservation = findRow(s, "reservations", input.reservationId);
          if (!consumingStatuses.has(reservation.status) || dateKey(reservation.checkOut) <= hotelToday(now)) reject("Only current or future inventory-consuming reservations can receive assignments.");
          if (s.roomAssignments.filter(a => !a.releasedAt && a.reservationId === reservation.id).length >= reservation.rooms) reject("This reservation already has its requested number of room assignments.");
          assertRoomFree(s, input.roomId, dateKey(reservation.checkIn), dateKey(reservation.checkOut));
          const assignmentId = await unit.insert("roomAssignments", { roomId: input.roomId, reservationId: reservation.id, assignedBy: actorId });
          return finish({ assignmentId, roomId: input.roomId, reservationId: reservation.id });
        }
        case "room.release": {
          const assignment = findRow(s, "roomAssignments", input.assignmentId);
          if (assignment.releasedAt) reject("This assignment is already released.");
          if (findRow(s, "reservations", assignment.reservationId).status === "checked in") reject("Check out the reservation before releasing an occupied room.");
          await unit.update("roomAssignments", assignment.id, { releasedAt: now });
          return finish({ before: assignment, releasedAt: now });
        }
        case "housekeeping.create": {
          const taskId = await task(unit, input.roomId, actorId, input.reason, input.assignedTo);
          return finish({ taskId, roomId: input.roomId, assignedTo: input.assignedTo ?? actorId });
        }
        case "housekeeping.advance": {
          const current = findRow(s, "housekeepingTasks", input.taskId);
          const next = { open: "in progress", "in progress": "completed", completed: "inspected", inspected: null }[current.status];
          if (input.status !== next) reject("Housekeeping must progress from open to in progress, completed, then inspected.");
          await unit.update("housekeepingTasks", current.id, { status: input.status });
          await unit.update("physicalRooms", current.roomId, { housekeepingStatus: input.status === "inspected" ? "inspected" : input.status === "completed" ? "clean" : "dirty" });
          return finish({ before: current, status: input.status });
        }
        case "maintenance.create": {
          requireReady(s, now);
          validateStay(input.startDate, input.endDate, now);
          assertRoomFree(s, input.roomId, input.startDate, input.endDate);
          if (available(s, input.startDate, input.endDate, now) < 1) reject("Maintenance would displace an existing reservation or hold.");
          const blockId = await unit.insert("inventoryBlocks", { roomCategoryId: input.categoryId, startDate: asDate(input.startDate), endDate: asDate(input.endDate), quantity: 1, reason: input.reason, createdBy: actorId });
          const maintenanceId = await unit.insert("roomMaintenance", { roomId: input.roomId, inventoryBlockId: blockId });
          return finish({ maintenanceId, blockId, roomId: input.roomId, startDate: input.startDate, endDate: input.endDate });
        }
        case "maintenance.release": {
          const maintenance = findRow(s, "roomMaintenance", input.maintenanceId);
          const block = findRow(s, "inventoryBlocks", maintenance.inventoryBlockId);
          if (block.releasedAt) reject("Maintenance is already released.");
          await unit.update("inventoryBlocks", block.id, { releasedAt: now });
          const cleaning = await requireCleaning(unit, maintenance.roomId, actorId, "Cleaning and inspection required after maintenance");
          return finish({ maintenance, before: block, releasedAt: now, cleaning });
        }
        case "maintenance.releaseBlock": {
          const block = findRow(s, "inventoryBlocks", input.blockId);
          if (s.roomMaintenance.some(row => row.inventoryBlockId === block.id)) reject("Release the linked room maintenance job so cleaning is recorded too.");
          if (block.releasedAt) reject("This inventory block is already released.");
          await unit.update("inventoryBlocks", block.id, { releasedAt: now });
          return finish({ before: block, releasedAt: now });
        }
        case "hold.create": {
          requireReady(s, now); validateStay(input.checkIn, input.checkOut, now);
          if (!s.category.isActive) reject("This category is not open for booking.");
          if (available(s, input.checkIn, input.checkOut, now) < input.rooms) reject("There is not enough inventory for this hold.");
          const token = nanoid(32);
          const expiresAt = new Date(now.getTime() + input.minutes * 60000);
          const holdId = await unit.insert("bookingHolds", { token, roomCategoryId: input.categoryId, checkIn: asDate(input.checkIn), checkOut: asDate(input.checkOut), rooms: input.rooms, expiresAt });
          await finish({ holdId, expiresAt, rooms: input.rooms, checkIn: input.checkIn, checkOut: input.checkOut });
          return { message: "Hold saved.", details: { holdId, token, expiresAt } };
        }
        case "hold.release": {
          const hold = findRow(s, "bookingHolds", input.holdId);
          if (hold.status !== "active") reject("This hold is no longer active.");
          await unit.update("bookingHolds", hold.id, { status: "released" });
          return finish({ holdId: hold.id });
        }
        case "reservation.create":
          return { message: "Reservation saved.", details: await create(unit, { ...input, roomCategoryId: input.categoryId }, actorId, input.source, input.reason) };
        case "reservation.amend": {
          requireReady(s, now);
          const reservation = findRow(s, "reservations", input.reservationId);
          if (!["pending manual confirmation", "pending payment", "confirmed"].includes(reservation.status)) reject("This reservation cannot be amended in its current state.");
          const expected = { checkIn: dateKey(reservation.checkIn), checkOut: dateKey(reservation.checkOut), rooms: reservation.rooms, total: reservation.total };
          if (reservationRevision(reservation) !== input.expectedRevision) reject("The reservation changed. Reload before amending it.");
          if (s.roomAssignments.some(a => a.reservationId === reservation.id && !a.releasedAt)) reject("Release existing assignments explicitly before amending the stay.");
          validateStay(input.checkIn, input.checkOut, now);
          if (s.category.maxOccupancy === null || input.adults + input.children > s.category.maxOccupancy * input.rooms) reject("Guest count exceeds configured occupancy.", "BAD_REQUEST");
          if (available(s, input.checkIn, input.checkOut, now, reservation.id) < input.rooms) reject("The amended stay has insufficient inventory.");
          if (reservation.currency !== "NGN") reject("Non-NGN reservations require a separate financial review.");
          const price = quote(s, input.checkIn, input.checkOut, input.rooms);
          if (cents(price.total) < cents(reservation.amountPaid)) reject("This amendment would require a refund. No financial change was made.");
          // Match the existing TIMESTAMP(0) precision in both the row and audit.
          const updatedAt = new Date(Math.floor(now.getTime() / 1000) * 1000);
          const after = { ...price, checkIn: asDate(input.checkIn), checkOut: asDate(input.checkOut), rooms: input.rooms, adults: input.adults, children: input.children, outstanding: money(cents(price.total) - cents(reservation.amountPaid)), updatedAt };
          await unit.insert("reservationAmendments", { reservationId: reservation.id, actorId, reason: input.reason, beforeSnapshot: JSON.stringify(reservation), afterSnapshot: JSON.stringify({ ...reservation, ...after }) });
          // Payment records, amountPaid, original status/history and agreed terms stay intact.
          await unit.update("reservations", reservation.id, after);
          return finish({ reservationId: reservation.id, before: expected, after });
        }
        case "reservation.status": {
          const reservation = findRow(s, "reservations", input.reservationId);
          const releasedAssignmentIds: number[] = [], cleaningChanges: unknown[] = [];
          if (reservation.status !== input.expectedStatus) reject("The reservation status changed. Reload before continuing.");
          if (!transitions[reservation.status]?.includes(input.status)) reject("This reservation status transition is not allowed.");
          if (consumingStatuses.has(input.status)) {
            requireReady(s, now);
            if (available(s, dateKey(reservation.checkIn), dateKey(reservation.checkOut), now, reservation.id) < reservation.rooms) reject("Not enough inventory for this status transition.");
          }
          if (input.status === "checked in") {
            if (dateKey(reservation.checkIn) > hotelToday(now) || dateKey(reservation.checkOut) <= hotelToday(now)) reject("Check-in must occur during the booked stay.");
            for (const assignment of s.roomAssignments.filter(a => a.reservationId === reservation.id && !a.releasedAt)) {
              const room = assertRoomFree(s, assignment.roomId, dateKey(reservation.checkIn), dateKey(reservation.checkOut), reservation.id);
              if (room.housekeepingStatus === "dirty") reject("Clean the assigned rooms before check-in.");
            }
          }
          if (input.status === "cancelled" || input.status === "checked out" || input.status === "expired" || input.status === "payment failed") {
            for (const assignment of s.roomAssignments.filter(a => a.reservationId === reservation.id && !a.releasedAt)) {
              await unit.update("roomAssignments", assignment.id, { releasedAt: now });
              releasedAssignmentIds.push(assignment.id);
              if (input.status === "checked out") {
                cleaningChanges.push(await requireCleaning(unit, assignment.roomId, actorId, "Cleaning required after checkout"));
              }
            }
          }
          await unit.update("reservations", reservation.id, { status: input.status });
          await unit.insert("reservationStatusHistory", { reservationId: reservation.id, fromStatus: reservation.status, toStatus: input.status, actorType: "staff", actorId, note: input.reason });
          return finish({ reservationId: reservation.id, fromStatus: reservation.status, toStatus: input.status, releasedAssignmentIds, cleaningChanges });
        }
      }
    });
  }

  return {
    execute,
    createPublic(raw: NewReservation) {
      const input = newReservationInput.parse(raw);
      return repository.withCategory(input.roomCategoryId, unit => create(unit, input, null, "website", "Public booking request; server price and terms snapshot"));
    },
    async search(input: { checkIn: string; checkOut: string; adults: number; children: number; rooms: number; roomSlug?: string }) {
      const dates = validateStay(input.checkIn, input.checkOut, clock());
      const rows: Array<{ id: number; slug: string; name: string; available: number; nightlyRate: number; nightly: Array<{ date: string; amount: string }>; maxOccupancy: number; nights: number; total: number; verification: string }> = [];
      let configured = false;
      for (const id of await repository.categoryIds(input.roomSlug)) {
        const result = await repository.withCategory(id, async unit => {
          const s = unit.state;
          if (!s.category.isActive || !s.policy) return null;
          configured = true;
          if (s.category.maxOccupancy === null || input.adults + input.children > s.category.maxOccupancy * input.rooms) return null;
          const count = Math.max(0, available(s, input.checkIn, input.checkOut, clock()));
          if (count < input.rooms) return null;
          const price = quote(s, input.checkIn, input.checkOut, input.rooms);
          const nightly = JSON.parse(price.rateSnapshot).nightly as Array<{ date: string; amount: string }>;
          return { id, slug: s.category.slug, name: s.category.name, maxOccupancy: s.category.maxOccupancy!, available: count, nightlyRate: Number(nightly[0].amount), nightly, nights: price.nights, total: Number(price.total), verification: s.category.verification };
        });
        if (result) rows.push(result);
      }
      return { configured, nights: dates.length, rooms: rows };
    },
    snapshot(categoryId: number) {
      return repository.withCategory(categoryId, async unit => {
        let effectiveCapacity: number | null = null, peakCommitments: number | null = null;
        try { effectiveCapacity = capacity(unit.state); peakCommitments = peakUsage(unit.state, clock()); } catch { /* Keep review tools accessible for reconciliation. */ }
        return { ...unit.state, effectiveCapacity, peakCommitments, reconciliationRequired: !unit.state.policy || effectiveCapacity === null || peakCommitments === null,
          reservationRevisions: Object.fromEntries(unit.state.reservations.map(row => [row.id, reservationRevision(row)])) };
      });
    },
    history: (categoryId: number) => repository.history(categoryId),
  };
}

export const hotelManagement = management();

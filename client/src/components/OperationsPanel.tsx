import { useState, type FormEvent } from "react";
import { trpc } from "@/lib/trpc";
import { dateKey, operationInput, reservationStatuses, type Operation } from "@shared/operations";

type Category = { id: number; name: string };
type Field = { name: string; label: string; type?: "date" | "number" | "email" | "textarea"; options?: string[]; optional?: boolean };
const field = (name: string, label: string, type?: Field["type"]): Field => ({ name, label, type });
const dates = [field("checkIn", "Check in", "date"), field("checkOut", "Check out", "date")];
const people = [field("rooms", "Rooms", "number"), field("adults", "Adults", "number"), field("children", "Children", "number")];
const actions: Record<Operation["action"], { label: string; fields: Field[] }> = {
  "room.create": { label: "Add a physical room", fields: [field("label", "Hotel room number or label"), { name: "isActive", label: "Active", options: ["true", "false"] }] },
  "room.active": { label: "Activate or deactivate a room", fields: [field("roomId", "Room ID", "number"), { name: "isActive", label: "Active", options: ["true", "false"] }] },
  "room.assign": { label: "Assign a room to a reservation", fields: [field("reservationId", "Reservation ID", "number"), field("roomId", "Room ID", "number")] },
  "room.release": { label: "Release a room assignment", fields: [field("assignmentId", "Assignment ID", "number")] },
  "rate.set": { label: "Set a nightly rate", fields: [{ name: "rateDate", label: "Rate date (blank for default)", type: "date", optional: true }, field("amount", "Nightly amount in NGN")] },
  "housekeeping.create": { label: "Create a cleaning task", fields: [field("roomId", "Room ID", "number"), { name: "assignedTo", label: "Assigned staff ID (blank for yourself)", type: "number", optional: true }] },
  "housekeeping.advance": { label: "Update a cleaning task", fields: [field("taskId", "Task ID", "number"), { name: "status", label: "Next state", options: ["in progress", "completed", "inspected"] }] },
  "maintenance.create": { label: "Schedule room maintenance", fields: [field("roomId", "Room ID", "number"), field("startDate", "Start date", "date"), field("endDate", "End date (exclusive)", "date")] },
  "maintenance.release": { label: "Release maintenance", fields: [field("maintenanceId", "Maintenance ID", "number")] },
  "maintenance.releaseBlock": { label: "Release a category inventory block", fields: [field("blockId", "Inventory block", "number")] },
  "reservation.create": { label: "Create a manual reservation", fields: [field("name", "Guest name"), field("email", "Guest email", "email"), field("phone", "Guest telephone"), ...dates, ...people, { name: "source", label: "Source", options: ["staff", "walk in", "telephone", "whatsapp"] }] },
  "reservation.status": { label: "Change reservation status", fields: [field("reservationId", "Reservation ID", "number"), { name: "status", label: "New status", options: [...reservationStatuses] }] },
  "reservation.amend": { label: "Amend and reprice a reservation", fields: [field("reservationId", "Reservation ID", "number"), ...dates, ...people] },
  "inventory.reconcile": { label: "Review and reconcile inventory", fields: [{ name: "capacitySource", label: "Capacity authority", options: ["category", "physical"] }, { name: "reviewedCancellationIds", label: "Reviewed cancellation request IDs (comma separated; blank if none)", optional: true }] },
  "hold.create": { label: "Create an inventory hold", fields: [...dates, field("rooms", "Rooms", "number"), field("minutes", "Expiry in minutes (1–30)", "number")] },
  "hold.release": { label: "Release a hold", fields: [field("holdId", "Hold ID", "number")] },
  "terms.approve": { label: "Approve booking terms", fields: [field("terms", "Hotel-approved booking terms", "textarea")] },
};
type DisplayRow = Record<string, unknown>;
function Records({ rows, columns }: { rows: DisplayRow[]; columns: string[] }) {
  if (!rows.length) return <div className="empty-state">No records in this category.</div>;
  return <div className="admin-table-wrap"><table className="admin-table"><thead><tr>{columns.map(column => <th key={column}>{column.replace(/([A-Z])/g, " $1")}</th>)}</tr></thead><tbody>{rows.map((row, i) => <tr key={String(row.id ?? i)}>{columns.map(column => <td key={column}>{row[column] instanceof Date ? (row[column] as Date).toISOString() : typeof row[column] === "boolean" ? (row[column] ? "Yes" : "No") : String(row[column] ?? "—")}</td>)}</tr>)}</tbody></table></div>;
}

export default function OperationsPanel({ categories }: { categories: Category[] }) {
  const [selected, setSelected] = useState("");
  const categoryId = Number(selected || categories[0]?.id || 0);
  const [tab, setTab] = useState("Rooms");
  const [action, setAction] = useState<Operation["action"]>("room.create");
  const [values, setValues] = useState<Record<string, string>>({});
  const [expected, setExpected] = useState<{ checkIn: string; checkOut: string; rooms: number; total: string; revision: string; status: typeof reservationStatuses[number] }>();
  const [message, setMessage] = useState("");
  const utils = trpc.useUtils();
  const snapshot = trpc.operations.snapshot.useQuery({ categoryId }, { enabled: categoryId > 0, retry: false });
  const history = trpc.operations.history.useQuery({ categoryId }, { enabled: categoryId > 0 && tab === "History", retry: false });
  const execute = trpc.operations.execute.useMutation({
    onSuccess: result => {
      const details = result.details as Record<string, unknown>;
      const suffix = details?.reference ? ` Reference: ${String(details.reference)}.` : details?.token ? ` Hold token: ${String(details.token)}. Expires: ${String(details.expiresAt)}.` : "";
      setMessage(`${result.message}${suffix}`);
      setExpected(undefined);
      void utils.operations.snapshot.invalidate(); void utils.operations.history.invalidate(); void utils.admin.summary.invalidate(); void utils.admin.roomDrafts.invalidate();
    },
    onError: error => setMessage(error.message),
  });
  const s = snapshot.data;
  const choices: Record<string, Array<{ value: number; label: string }>> = s ? {
    roomId: s.physicalRooms.map(row => ({ value: row.id, label: `${row.label}${row.isActive ? "" : " (inactive)"}` })),
    reservationId: s.reservations.map(row => ({ value: row.id, label: `${row.reference} — ${row.status}` })),
    assignmentId: s.roomAssignments.filter(row => !row.releasedAt).map(row => ({ value: row.id, label: `Assignment ${row.id}: room ${s.physicalRooms.find(room => room.id === row.roomId)?.label ?? row.roomId}, reservation ${row.reservationId}` })),
    taskId: s.housekeepingTasks.filter(row => row.status !== "inspected").map(row => ({ value: row.id, label: `Task ${row.id}: room ${s.physicalRooms.find(room => room.id === row.roomId)?.label ?? row.roomId}, ${row.status}` })),
    maintenanceId: s.roomMaintenance.filter(row => !s.inventoryBlocks.find(block => block.id === row.inventoryBlockId)?.releasedAt).map(row => ({ value: row.id, label: `Maintenance ${row.id}: room ${s.physicalRooms.find(room => room.id === row.roomId)?.label ?? row.roomId}` })),
    holdId: s.bookingHolds.filter(row => row.status === "active").map(row => ({ value: row.id, label: `Hold ${row.id}: ${dateKey(row.checkIn)} to ${dateKey(row.checkOut)}` })),
    blockId: s.inventoryBlocks.filter(row => !row.releasedAt && !s.roomMaintenance.some(job => job.inventoryBlockId === row.id)).map(row => ({ value: row.id, label: `Block ${row.id}: ${row.quantity} rooms, ${dateKey(row.startDate)} to ${dateKey(row.endDate)} — ${row.reason}` })),
  } : {};
  function update(name: string, value: string) {
    setValues(previous => ({ ...previous, [name]: value }));
    if (name === "reservationId") {
      const reservation = s?.reservations.find(row => row.id === Number(value));
      setExpected(reservation ? { checkIn: dateKey(reservation.checkIn), checkOut: dateKey(reservation.checkOut), rooms: reservation.rooms, total: reservation.total, revision: s?.reservationRevisions[reservation.id] ?? "", status: reservation.status } : undefined);
      if (reservation && action === "reservation.amend") setValues(previous => ({ ...previous, reservationId: value, checkIn: dateKey(reservation.checkIn), checkOut: dateKey(reservation.checkOut), rooms: String(reservation.rooms), adults: String(reservation.adults), children: String(reservation.children) }));
    }
  }
  function submit(event: FormEvent) {
    event.preventDefault(); setMessage("");
    try {
      const raw: Record<string, unknown> = { ...values, action, categoryId };
      for (const name of ["roomId", "reservationId", "assignmentId", "taskId", "maintenanceId", "blockId", "assignedTo", "rooms", "adults", "children", "minutes", "holdId"]) {
        if (name in raw) raw[name] = raw[name] === "" ? undefined : Number(raw[name]);
      }
      if ("isActive" in raw) raw.isActive = raw.isActive === "true";
      if (action === "rate.set") raw.rateDate = raw.rateDate || null;
      if (action === "inventory.reconcile") raw.reviewedCancellationIds = values.reviewedCancellationIds?.trim() ? values.reviewedCancellationIds.split(",").map(id => Number(id.trim())) : [];
      if (action === "reservation.status") raw.expectedStatus = expected?.status;
      if (action === "reservation.amend" && expected) raw.expectedRevision = expected.revision;
      execute.mutate(operationInput.parse(raw));
    } catch { setMessage("Review the fields and select a reservation from the current category where required. Dates, amounts, and a reason of at least five characters are required."); }
  }
  const views: Record<string, { rows: DisplayRow[]; columns: string[] }> = s ? {
    Rooms: { rows: s.physicalRooms, columns: ["id", "label", "isActive", "housekeepingStatus"] },
    Assignments: { rows: s.roomAssignments, columns: ["id", "reservationId", "roomId", "releasedAt"] },
    Reservations: { rows: s.reservations.map(row => ({ ...row, guestName: s.guests.find(guest => guest.id === row.guestId)?.name })), columns: ["id", "reference", "guestName", "checkIn", "checkOut", "rooms", "status", "total", "amountPaid", "outstanding"] },
    Contacts: { rows: s.guests, columns: ["id", "name", "email", "phone"] },
    "Status history": { rows: s.reservationStatusHistory, columns: ["id", "reservationId", "fromStatus", "toStatus", "actorType", "actorId", "note", "createdAt"] },
    Rates: { rows: s.roomRates, columns: ["id", "rateDate", "amount", "currency", "isActive"] },
    Housekeeping: { rows: s.housekeepingTasks, columns: ["id", "roomId", "status", "assignedTo", "note"] },
    Maintenance: { rows: s.roomMaintenance.map(row => { const block = s.inventoryBlocks.find(block => block.id === row.inventoryBlockId); return { ...row, startDate: block?.startDate, endDate: block?.endDate, reason: block?.reason, releasedAt: block?.releasedAt }; }), columns: ["id", "roomId", "inventoryBlockId", "startDate", "endDate", "reason", "releasedAt"] },
    Holds: { rows: s.bookingHolds, columns: ["id", "checkIn", "checkOut", "rooms", "status", "expiresAt"] },
    Blocks: { rows: s.inventoryBlocks, columns: ["id", "startDate", "endDate", "quantity", "reason", "releasedAt"] },
    Amendments: { rows: s.reservationAmendments, columns: ["id", "reservationId", "actorId", "reason", "createdAt"] },
  } : {};
  if (!categories.length) return <section className="admin-panel" style={{ marginTop: 17 }}><h2>Hotel operations</h2><div className="empty-state">Configure verified room categories through the authorized database setup before using hotel operations.</div></section>;
  return <section className="admin-panel" style={{ marginTop: 17 }}><h2>Hotel operations</h2>
    <label>Room category <select value={categoryId} onChange={event => { setSelected(event.target.value); setValues({}); setExpected(undefined); setMessage(""); }}>{categories.map(category => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
    {snapshot.isLoading ? <div className="empty-state">Loading operational records…</div> : snapshot.error ? <div className="admin-note" role="alert">Operational services are unavailable. <button type="button" className="text-link" onClick={() => void snapshot.refetch()}>Try again</button></div> : s && <>
      <p className="admin-note">Capacity: {s.effectiveCapacity ?? "review required"}, from {s.policy?.capacitySource ?? "category"} inventory. Peak current and future commitments: {s.peakCommitments ?? "review required"}. {s.reconciliationRequired ? "New bookings, holds, assignments, and maintenance require an explicit inventory review first." : "Cancellation requests retain inventory until staff approve cancellation."} Physical assignments do not consume additional category inventory.</p>
      <div className="hero-actions" style={{ flexWrap: "wrap", marginBottom: 16 }}>{[...Object.keys(views), "History"].map(name => <button type="button" className={tab === name ? "button button-copper" : "button button-outline"} key={name} onClick={() => setTab(name)}>{name}</button>)}</div>
      {tab === "History" ? history.error ? <div role="alert">History is unavailable.</div> : history.isLoading ? <div>Loading history…</div> : <Records rows={(history.data ?? []) as DisplayRow[]} columns={["id", "action", "actorId", "details", "createdAt"]} /> : views[tab] && <Records {...views[tab]} />}
      <h2 style={{ marginTop: 28 }}>Record an operation</h2>
      <label>Action <select value={action} onChange={event => { setAction(event.target.value as Operation["action"]); setValues({}); setExpected(undefined); setMessage(""); }}>{Object.entries(actions).map(([key, value]) => <option key={key} value={key}>{value.label}</option>)}</select></label>
      {action === "inventory.reconcile" && <p className="admin-note">Review existing cancellation requests before saving. Current request IDs: {s.reservations.filter(row => row.status === "cancellation requested").map(row => row.id).join(", ") || "none"}. Reconciliation does not change reservations or amounts. Switching to physical capacity requires enough active physical rooms for every existing commitment.</p>}
      {action === "reservation.amend" && <p className="admin-note">This explicitly changes dates, guest counts, and server-calculated prices. Existing payments and agreed terms remain intact. Release assignments first. Changes requiring refunds are blocked.</p>}
      {action === "terms.approve" && <p className="admin-note">These approved terms apply to all new reservations. Existing agreed terms remain unchanged.</p>}
      <form className="booking-form" onSubmit={submit} style={{ marginTop: 16 }}>
        {actions[action].fields.map(f => <label key={f.name}><span>{f.label}</span>{choices[f.name] ? <select required value={values[f.name] ?? ""} onChange={event => update(f.name, event.target.value)}><option value="">Choose?</option>{choices[f.name].map(choice => <option key={choice.value} value={choice.value}>{choice.label}</option>)}</select> : f.options ? <select required={!f.optional} value={values[f.name] ?? ""} onChange={event => update(f.name, event.target.value)}><option value="">Choose…</option>{f.options.map(value => <option key={value}>{value}</option>)}</select> : f.type === "textarea" ? <textarea required value={values[f.name] ?? ""} onChange={event => update(f.name, event.target.value)} rows={5} /> : <input required={!f.optional} type={f.type ?? "text"} value={values[f.name] ?? ""} onChange={event => update(f.name, event.target.value)} />}</label>)}
        {action !== "room.create" && <label><span>Reason or operational note</span><input required minLength={5} maxLength={action === "maintenance.create" ? 255 : 2000} value={values.reason ?? ""} onChange={event => update("reason", event.target.value)} /></label>}
        <button className="button button-copper" disabled={execute.isPending} type="submit">{execute.isPending ? "Saving…" : "Save operation"}</button>
      </form><p className="admin-note" role="status" style={{ overflowWrap: "anywhere" }}>{message}</p>
    </>}
  </section>;
}

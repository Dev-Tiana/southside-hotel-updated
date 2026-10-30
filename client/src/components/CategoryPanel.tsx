import { useState, type FormEvent } from "react";
import { trpc } from "@/lib/trpc";
import { categoryCreate, categorySave, categoryInventory, type CategoryDetails } from "@shared/categories";

function lines(value: string) { return value.split("\n").map(s => s.trim()).filter(Boolean); }
export default function CategoryPanel({ categories }: { categories: Array<{ id: number; name: string }> }) {
  const [selected, setSelected] = useState("");
  const [message, setMessage] = useState("");
  const id = Number(selected);
  const detail = trpc.admin.category.useQuery({ categoryId: id }, { enabled: id > 0, retry: false });
  const utils = trpc.useUtils();
  async function refreshed(text: string) {
    setMessage(text);
    await Promise.all([utils.admin.category.invalidate(), utils.admin.roomDrafts.invalidate(), utils.admin.summary.invalidate(), utils.hotel.rooms.invalidate(), utils.operations.snapshot.invalidate(), utils.operations.history.invalidate()]);
  }
  const create = trpc.admin.createCategory.useMutation({ onSuccess: async r => { setSelected(String(r.id)); await refreshed(r.message); }, onError: e => setMessage(e.message) });
  const save = trpc.admin.saveCategory.useMutation({ onSuccess: r => refreshed(r.message), onError: e => setMessage(e.message) });
  const inventory = trpc.admin.categoryInventory.useMutation({ onSuccess: r => refreshed(r.message), onError: e => setMessage(e.message) });
  const pending = create.isPending || save.isPending || inventory.isPending;
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setMessage("");
    const data = new FormData(event.currentTarget);
    const text = (key: string) => String(data.get(key) ?? "");
    const images = lines(text("images")).map(line => { const [url, ...alt] = line.split("|"); return { url: url.trim(), alt: alt.join("|").trim() }; });
    const values: CategoryDetails = { name: text("name"), description: text("description"), maxOccupancy: Number(text("maxOccupancy")), bedConfiguration: text("bedConfiguration"), amenities: lines(text("amenities")), verification: text("verification") as CategoryDetails["verification"], images };
    const raw = id ? { ...values, categoryId: id, expectedRevision: detail.data?.revision, isActive: data.has("isActive"), reason: text("reason") } : { ...values, slug: text("slug"), reason: text("reason") };
    const parsed = id ? categorySave.safeParse(raw) : categoryCreate.safeParse(raw);
    if (!parsed.success) { setMessage(parsed.error.issues[0]?.message || "Review category details."); return; }
    if (id) save.mutate(categorySave.parse(raw)); else create.mutate(categoryCreate.parse(raw));
  }
  const d = detail.data;
  let amenities: string[] = [];
  try { amenities = d?.amenities ? JSON.parse(d.amenities) : []; } catch { amenities = d?.amenities ? [d.amenities] : []; }
  return <section className="admin-panel category-panel" style={{ marginTop: 17 }}>
    <h2>Room category management</h2>
    <label>Category<select value={selected} onChange={e => { setSelected(e.target.value); setMessage(""); }}><option value="">Create a new category</option>{categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
    {detail.isFetching && id > 0 && <p role="status">Loading category details…</p>}
    {detail.error && <p role="alert">{detail.error.message} <button type="button" className="text-link" onClick={() => void detail.refetch()}>Try again</button></p>}
    {(!id || d?.id === id) && <form key={`${id}-${d?.revision ?? "new"}`} className="booking-form category-form" onSubmit={submit}>
      <label><span>Name</span><input name="name" defaultValue={d?.name ?? ""} minLength={2} maxLength={160} required /></label>
      {!id && <label><span>URL slug</span><input name="slug" placeholder="garden-suite" pattern="[a-z0-9]+(-[a-z0-9]+)*" maxLength={120} required /></label>}
      <label><span>Description</span><textarea name="description" defaultValue={d?.description ?? ""} maxLength={10000} /></label>
      <label><span>Maximum guests per room</span><input name="maxOccupancy" type="number" min={1} max={100} defaultValue={d?.maxOccupancy ?? 2} required /></label>
      <label><span>Bed configuration</span><input name="bedConfiguration" defaultValue={d?.bedConfiguration ?? ""} maxLength={1000} /></label>
      <label><span>Amenities (one per line)</span><textarea name="amenities" defaultValue={amenities.join("\n")} /></label>
      <label><span>Verification</span><select name="verification" defaultValue={d?.verification ?? "awaiting approval"}>{["verified", "provisional", "awaiting approval"].map(v => <option key={v}>{v}</option>)}</select></label>
      <label><span>Images (one local path | description per line)</span><textarea name="images" placeholder="/hotel-media/garden.jpg | Garden room" defaultValue={d?.images.map(image => `${image.url} | ${image.alt}`).join("\n") ?? ""} /></label>
      {id > 0 && <label className="consent-label"><input name="isActive" type="checkbox" defaultChecked={d?.isActive} /><span>Active category (available to new guests once rates and inventory are ready)</span></label>}
      <label><span>Reason for change</span><textarea name="reason" minLength={5} maxLength={2000} required /></label>
      <button className="button button-copper" disabled={pending} type="submit">{pending ? "Saving…" : id ? "Save category" : "Create category"}</button>
    </form>}
    <p className="admin-note">Existing URLs stay fixed. Images reference existing approved local hotel files; this form does not upload files. Creation starts inactive with zero capacity. Use Hotel operations for rates, physical rooms and audit history.</p>
    {d?.id === id && <form key={`inventory-${d.revision}`} className="booking-form category-form" onSubmit={event => {
      event.preventDefault(); setMessage(""); const data = new FormData(event.currentTarget);
      const result = categoryInventory.safeParse({ categoryId: id, expectedRevision: d.revision, sellableInventory: Number(data.get("inventory")), reviewedCancellationIds: String(data.get("reviewed") || "").split(",").map(s => s.trim()).filter(Boolean).map(Number), reconciliationAccepted: data.has("accepted"), reason: data.get("reason") });
      if (!result.success) setMessage(result.error.issues[0]?.message || "Review inventory details."); else inventory.mutate(result.data);
    }}>
      <label><span>Category sellable capacity</span><input name="inventory" type="number" min={0} max={10000} defaultValue={d.sellableInventory} required /></label>
      <label><span>Reviewed cancellation request IDs (comma separated)</span><input name="reviewed" /></label>
      <label><span>Inventory reconciliation reason</span><textarea name="reason" minLength={5} maxLength={2000} required /></label>
      <label className="consent-label"><input name="accepted" type="checkbox" required /><span>I reviewed current commitments and cancellation requests in Hotel operations. Category capacity remains authoritative.</span></label>
      <button className="button button-copper" disabled={pending} type="submit">Reconcile category inventory</button>
    </form>}
    {message && <p role="status">{message}</p>}
  </section>;
}

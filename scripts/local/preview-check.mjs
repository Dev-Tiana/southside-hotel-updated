import assert from "node:assert/strict";
import { connectLocal, schemas, reportError } from "./common.mjs";

async function main() {
  const base = "http://127.0.0.1:3001";
  for (const route of ["/", "/accommodation", "/rooms/classic-room", "/booking", "/admin"]) {
    const response = await fetch(base + route);
    assert.equal(response.status, 200);
    assert.match(await response.text(), /<div id="root">/);
  }
  const ready = await fetch(base + "/api/ready");
  assert.equal(ready.status, 200);
  assert.deepEqual(await ready.json(), { status: "ready" });
  const rpc = async (name, input, post = false) => {
    const body = JSON.stringify({ json: input });
    const response = await fetch(base + "/api/trpc/" + name + (post ? "" : "?input=" + encodeURIComponent(body)), post ? { method: "POST", headers: { "content-type": "application/json" }, body } : {});
    return { status: response.status, body: await response.json() };
  };
  const rooms = await rpc("hotel.rooms", null);
  assert.equal(rooms.status, 200);
  const category = rooms.body.result.data.json.find(row => row.slug === "classic-room");
  assert.match(category.name, /^LOCAL SAMPLE/);
  for (const name of ["admin.summary", "operations.snapshot"]) {
    const response = await rpc(name, { categoryId: category.id });
    assert.equal(response.status, 401);
    assert.equal(response.body.error.json.data.code, "UNAUTHORIZED");
  }
  const invalid = await rpc("booking.search", { checkIn: "2027-02-29", checkOut: "2027-03-01", adults: 1, children: 0, rooms: 1 }, true);
  assert.equal(invalid.status, 400);
  const date = offset => new Date(Date.now() + offset * 86400000).toISOString().slice(0, 10);
  const search = await rpc("booking.search", { checkIn: date(7), checkOut: date(9), adults: 1, children: 0, rooms: 1, roomSlug: category.slug }, true);
  assert.equal(search.status, 200);
  assert.equal(search.body.result.data.json.rooms[0].total, 20000);
  // A real HTTP reservation writes only invented data to the owned preview schema.
  const c = await connectLocal(schemas[0]);
  try {
    const [marker] = await c.query("SELECT settingValue FROM hotel_settings WHERE settingKey = 'local_http_booking_check'");
    if (!marker.length) {
      const booking = await rpc("booking.submit", { roomCategoryId: category.id, checkIn: date(7), checkOut: date(9), rooms: 1, adults: 1, children: 0, name: "LOCAL SAMPLE Browser Check", email: "preview@example.invalid", phone: "0000000000", total: 1, subtotal: 1 }, true);
      assert.equal(booking.status, 200);
      const id = booking.body.result.data.json.reservationId;
      const [rows] = await c.execute("SELECT total, source, status FROM reservations WHERE id = ?", [id]);
      assert.equal(rows[0].total, "20000.00");
      assert.equal(rows[0].source, "website");
      assert.equal(rows[0].status, "pending manual confirmation");
      await c.execute("INSERT INTO hotel_settings (settingKey, settingValue, verification) VALUES ('local_http_booking_check', 'fictional-only', 'confirmed')");
    }
    const [admins] = await c.query("SELECT COUNT(*) AS count FROM users WHERE role = 'admin'");
    assert.equal(Number(admins[0].count), 0);
  } finally { await c.end(); }
  console.log("Local HTTP checks passed: public route shells, ready response, sample availability/pricing, fictional booking persistence, invalid leap date and protected administrator APIs. No browser rendering assertion was performed.");
}
main().catch(reportError);

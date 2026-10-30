import { connectLocal, schemas, reportError } from "./common.mjs";

// Fictional inventory only. No Manus identity, login session or administrator.
const slugs = ["classic-room", "royal-suite", "superior-suite", "luxury-room-205", "luxury-room-208", "premium-room-306", "premium-room-308", "executive-accommodation"];
async function main() {
  const c = await connectLocal(schemas[0]);
  try {
    await c.beginTransaction();
    const [markers] = await c.query("SELECT settingValue FROM hotel_settings WHERE settingKey = 'local_sample_seed'");
    if (markers.length) { console.log("Local sample seed already exists; nothing changed."); await c.rollback(); return; }
    const [counts] = await c.query("SELECT (SELECT COUNT(*) FROM users) + (SELECT COUNT(*) FROM room_categories) + (SELECT COUNT(*) FROM reservations) + (SELECT COUNT(*) FROM guests) + (SELECT COUNT(*) FROM hotel_settings) AS count");
    if (Number(counts[0].count)) throw new Error("Refusing to seed a nonempty development database without its sample marker.");
    const [user] = await c.execute("INSERT INTO users (openId, name, role) VALUES (?, ?, 'user')", ["local-sample-no-login", "LOCAL SAMPLE fixture actor (no login)"]);
    for (const [index, slug] of slugs.entries()) {
      const [category] = await c.execute("INSERT INTO room_categories (slug, name, description, verification, maxOccupancy, sellableInventory, isActive) VALUES (?, ?, ?, 'provisional', 2, 3, 1)", [slug, `LOCAL SAMPLE ${slug.replaceAll('-', ' ')}`, "Fictional development inventory and rates. Not hotel availability."]);
      await c.execute("INSERT INTO room_rates (roomCategoryId, amount, isActive) VALUES (?, ?, 1)", [category.insertId, `${10000 + index * 1000}.00`]);
      await c.execute("INSERT INTO inventory_policies (roomCategoryId, capacitySource, reconciledCapacity, cancellationReconciledAt, reconciledBy, reason) VALUES (?, 'category', 3, NOW(), ?, ?)", [category.insertId, user.insertId, "LOCAL SAMPLE empty-category reconciliation; no existing cancellation requests"]);
      for (let room = 1; room <= 3; room++) await c.execute("INSERT INTO physical_rooms (roomCategoryId, label, housekeepingStatus) VALUES (?, ?, 'inspected')", [category.insertId, `SAMPLE-${index + 1}-${room}`]);
    }
    await c.execute("INSERT INTO hotel_settings (settingKey, settingValue, verification, updatedBy) VALUES ('approved_booking_terms', ?, 'confirmed', ?)", ["LOCAL DEVELOPMENT ONLY: fictional reservation, no accommodation commitment, no payment. Use invented contact information only.", user.insertId]);
    await c.execute("INSERT INTO hotel_settings (settingKey, settingValue, verification) VALUES ('local_sample_seed', 'v1-fictional-only', 'confirmed')");
    await c.execute("INSERT INTO audit_logs (actorType, action, entityType, details) VALUES ('local_fixture', 'local.sample.seed', 'development', ?)", [JSON.stringify({ categories: 8, physicalRooms: 24, capacitySource: "category", administratorCreated: false })]);
    await c.commit();
    console.log("Development samples created: 8 categories, 24 fictional rooms and rates; no reservations, payments, login sessions or administrators.");
  } catch (error) { await c.rollback(); throw error; }
  finally { await c.end(); }
}
main().catch(reportError);

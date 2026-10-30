// Node 24 can run these checks without installing application dependencies.
import { test } from "node:test";
import assert from "node:assert/strict";
import { isReservationDate } from "../shared/reservationDate.ts";
import { ServiceFailure, diagnose } from "../server/_core/diagnostics.ts";

for (const value of ["2026-10-26", "2028-02-29", "2026-01-01"]) {
  test(`valid date: ${value}`, () => assert.equal(isReservationDate(value), true));
}
for (const value of ["", "2026-02-29", "2026-04-31", "2026-13-01", "2026-00-01", "2026-01-00", "2026-1-01", "2026-01-01T00:00:00Z", "abcd-ef-gh", "\\dddd-\\dd-\\dd"]) {
  test(`invalid date: ${value}`, () => assert.equal(isReservationDate(value), false));
}
test("diagnostics expose only fixed categories and safe messages", () => {
  const original = console.warn;
  const messages = [];
  console.warn = (...args) => messages.push(args);
  try {
    for (const kind of ["invalid_session", "database_unavailable", "oauth_unavailable"]) {
      diagnose(kind);
      const error = new ServiceFailure(kind);
      assert.equal(error.kind, kind);
      assert.equal(error.message, kind === "invalid_session" ? "Session expired. Please sign in again." : "Service temporarily unavailable.");
    }
    assert.deepEqual(messages, [["[Service] invalid_session"], ["[Service] database_unavailable"], ["[Service] oauth_unavailable"]]);
  } finally { console.warn = original; }
});

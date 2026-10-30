import { expect, it } from "vitest";
import { isReservationDate } from "./reservationDate";

it.each(["2026-10-26", "2028-02-29", "2026-01-01"])("accepts %s", value => {
  expect(isReservationDate(value)).toBe(true);
});
it.each(["", "2026-02-29", "2026-04-31", "2026-13-01", "2026-00-01", "2026-01-00", "2026-1-01", "2026-01-01T00:00:00Z", "abcd-ef-gh", "\\dddd-\\dd-\\dd"])("rejects %s", value => {
  expect(isReservationDate(value)).toBe(false);
});

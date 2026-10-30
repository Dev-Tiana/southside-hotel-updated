import { describe, expect, it } from "vitest";
import { calculateStayTotal, nightsBetween, validateStayDates } from "./booking";

describe("hotel booking calculations", () => {
  it("counts nights using check in and check out boundaries", () => {
    expect(nightsBetween("2030-03-10", "2030-03-13")).toBe(3);
  });

  it("rejects past and reversed dates", () => {
    const today = new Date("2030-03-10T08:00:00Z");
    expect(validateStayDates("2030-03-09", "2030-03-11", today).valid).toBe(false);
    expect(validateStayDates("2030-03-13", "2030-03-11", today).message).toContain("later");
  });

  it("calculates rooms and explicitly supplied tax without inventing charges", () => {
    expect(calculateStayTotal(55000, 3, 2, 0)).toEqual({ subtotal: 330000, tax: 0, total: 330000 });
    expect(calculateStayTotal(55000, 1, 1, 2500)).toEqual({ subtotal: 55000, tax: 2500, total: 57500 });
  });
});

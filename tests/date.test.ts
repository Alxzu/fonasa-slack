import { describe, expect, test } from "bun:test";
import {
  formatDateES,
  formatDateISO,
  getLastBusinessDayOfPreviousMonth,
  getPreviousBusinessDay,
  parseDateES,
} from "../src/utils/date";

describe("formatDateISO", () => {
  test("returns YYYY-MM-DD", () => {
    expect(formatDateISO(new Date(2026, 3, 10))).toBe("2026-04-10");
  });

  test("pads single-digit month and day", () => {
    expect(formatDateISO(new Date(2026, 0, 5))).toBe("2026-01-05");
  });
});

describe("formatDateES", () => {
  test("returns DD/MM/YYYY", () => {
    expect(formatDateES(new Date(2026, 3, 10))).toBe("10/04/2026");
  });

  test("pads single-digit day and month", () => {
    expect(formatDateES(new Date(2026, 0, 5))).toBe("05/01/2026");
  });
});

describe("parseDateES", () => {
  test("parses DD/MM/YYYY correctly", () => {
    const date = parseDateES("10/04/2026");
    expect(date.getFullYear()).toBe(2026);
    expect(date.getMonth()).toBe(3);
    expect(date.getDate()).toBe(10);
  });

  test("roundtrips with formatDateES", () => {
    const original = new Date(2026, 11, 25);
    expect(parseDateES(formatDateES(original)).getTime()).toBe(
      original.getTime(),
    );
  });

  test("throws on invalid format", () => {
    expect(() => parseDateES("2026-04-10")).toThrow("Invalid date format");
  });

  test("throws on empty string", () => {
    expect(() => parseDateES("")).toThrow("Invalid date format");
  });

  test("throws on invalid date values", () => {
    expect(() => parseDateES("31/02/2026")).toThrow("Invalid date values");
  });
});

describe("getPreviousBusinessDay", () => {
  test("weekday returns previous day", () => {
    // Thursday April 9, 2026 -> Wednesday April 8
    const result = getPreviousBusinessDay(new Date(2026, 3, 9));
    expect(result.getDate()).toBe(8);
    expect(result.getDay()).toBe(3); // Wednesday
  });

  test("Saturday returns Friday", () => {
    // Saturday April 11, 2026 -> Friday April 10
    const result = getPreviousBusinessDay(new Date(2026, 3, 11));
    expect(result.getDate()).toBe(10);
    expect(result.getDay()).toBe(5); // Friday
  });

  test("Sunday returns Friday", () => {
    // Sunday April 12, 2026 -> Friday April 10
    const result = getPreviousBusinessDay(new Date(2026, 3, 12));
    expect(result.getDate()).toBe(10);
    expect(result.getDay()).toBe(5); // Friday
  });

  test("Monday returns Friday", () => {
    // Monday April 13, 2026 -> Friday April 10
    const result = getPreviousBusinessDay(new Date(2026, 3, 13));
    expect(result.getDate()).toBe(10);
    expect(result.getDay()).toBe(5); // Friday
  });
});

describe("getLastBusinessDayOfPreviousMonth", () => {
  test("April 10 returns last business day of March", () => {
    // March 31, 2026 is a Tuesday
    const result = getLastBusinessDayOfPreviousMonth(new Date(2026, 3, 10));
    expect(result.getMonth()).toBe(2); // March
    expect(result.getDate()).toBe(31);
    expect(result.getDay()).toBe(2); // Tuesday
  });

  test("handles February (non-leap year)", () => {
    // Feb 2026 has 28 days, Feb 28 is a Saturday -> should be Feb 27 (Friday)
    const result = getLastBusinessDayOfPreviousMonth(new Date(2026, 2, 15));
    expect(result.getMonth()).toBe(1); // February
    expect(result.getDate()).toBe(27);
    expect(result.getDay()).toBe(5); // Friday
  });

  test("handles year boundary (January -> December)", () => {
    // December 31, 2025 is a Wednesday
    const result = getLastBusinessDayOfPreviousMonth(new Date(2026, 0, 15));
    expect(result.getMonth()).toBe(11); // December
    expect(result.getFullYear()).toBe(2025);
    expect(result.getDate()).toBe(31);
    expect(result.getDay()).toBe(3); // Wednesday
  });

  test("adjusts when last day falls on weekend", () => {
    // May 31, 2026 is a Sunday -> should return May 29 (Friday)
    const result = getLastBusinessDayOfPreviousMonth(new Date(2026, 5, 10));
    expect(result.getMonth()).toBe(4); // May
    expect(result.getDate()).toBe(29);
    expect(result.getDay()).toBe(5); // Friday
  });
});

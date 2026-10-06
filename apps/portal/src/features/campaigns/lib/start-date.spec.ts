import { describe, expect, it } from "vitest";

import { latestStartDate, startDateProblem, todayInIndia } from "./start-date";

describe("start date limits (match the API, India calendar)", () => {
  // 20:00 UTC on Oct 6 is already 01:30 on Oct 7 in India.
  const lateEveningUtc = new Date("2026-10-06T20:00:00Z");

  it("'today' is India's date even late in the UTC evening", () => {
    expect(todayInIndia(lateEveningUtc)).toBe("2026-10-07");
    expect(startDateProblem("2026-10-06", lateEveningUtc)).toMatch(/past/);
    expect(startDateProblem("2026-10-07", lateEveningUtc)).toBeNull();
  });

  it("allows up to 12 months ahead, refuses typos like year 20260", () => {
    const now = new Date("2026-10-06T06:00:00Z");
    expect(latestStartDate(now)).toBe("2027-10-06");
    expect(startDateProblem("2027-10-06", now)).toBeNull();
    expect(startDateProblem("2027-10-07", now)).toMatch(/12 months/);
    expect(startDateProblem("20260-01-01", now)).toMatch(/12 months/);
  });

  it("empty is left to the 'required' check; garbage is invalid", () => {
    expect(startDateProblem("")).toBeNull();
    expect(startDateProblem("06/10/2026")).toMatch(/valid date/);
  });
});

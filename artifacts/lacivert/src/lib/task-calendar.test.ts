import assert from "node:assert/strict";
import { test } from "node:test";
import { calendarDays, calendarDayLabel, calendarMonthLabel, istanbulToday, shiftMonth } from "./task-calendar.ts";

test("today uses Istanbul's calendar day across UTC midnight and year boundary", () => {
  assert.equal(istanbulToday(new Date("2026-12-31T20:59:59Z")), "2026-12-31");
  assert.equal(istanbulToday(new Date("2026-12-31T21:00:00Z")), "2027-01-01");
  assert.equal(istanbulToday(new Date("2026-03-28T22:00:00Z")), "2026-03-29");
});

test("month navigation handles year boundaries and February without day overflow", () => {
  assert.equal(shiftMonth("2026-12", 1), "2027-01");
  assert.equal(shiftMonth("2027-01", -1), "2026-12");
  assert.equal(shiftMonth("2026-01", 1), "2026-02");
  assert.equal(shiftMonth(shiftMonth("2024-02", 1), -1), "2024-02");
});

test("calendar starts Monday and includes every date exactly once in full weeks", () => {
  for (const year of [2024, 2026, 2027]) {
    for (let m = 1; m <= 12; m++) {
      const month = `${year}-${String(m).padStart(2, "0")}`;
      const days = calendarDays(month);
      const dates = days.filter((d): d is string => d !== null);
      const count = new Date(Date.UTC(year, m, 0)).getUTCDate();
      assert.equal(days.length % 7, 0);
      assert.equal(dates.length, count);
      assert.equal(new Set(dates).size, count);
      dates.forEach((d, i) => {
        assert.equal(d, `${month}-${String(i + 1).padStart(2, "0")}`);
        assert.equal(days.indexOf(d) % 7, (new Date(`${d}T00:00:00Z`).getUTCDay() + 6) % 7);
      });
    }
  }
});

test("leap February and months spanning four to six weeks are supported", () => {
  assert.ok(calendarDays("2024-02").includes("2024-02-29"));
  assert.ok(!calendarDays("2026-02").includes("2026-02-29"));
  assert.equal(calendarDays("2027-02").length, 28);
  assert.equal(calendarDays("2026-08").length, 42);
  assert.equal(calendarDays("2026-06")[0], "2026-06-01");
});

test("labels are Turkish and date-only values never shift to the previous day", () => {
  assert.equal(calendarMonthLabel("2026-10"), "Ekim 2026");
  assert.equal(calendarDayLabel("2026-10-01"), "1 Ekim Perşembe");
});

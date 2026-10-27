import { describe, expect, it } from "vitest";
import holidaysJson from "../data/holidays.json";
import {
  calculateOvertime,
  DEFAULT_SETTINGS,
  formatDecimalHours,
  formatHM,
  formatHolidayLabel,
  hasHolidayData,
  type Holiday,
  type HolidayWorkMode,
  toMinutes,
  weekdayHolidays,
} from "./overtime";

const holidays = holidaysJson as Holiday[];

// 작업 지시서 3번 테스트 케이스 (구글 시트로 검증된 값)
interface Case {
  no: number;
  ym: [number, number];
  total: [number, number];
  holidayWork: [number, number];
  mode: HolidayWorkMode;
  holidayCount: number;
  base: string;
  overtime: string;
  overtimeDecimal?: string;
  remaining: string;
  holidayWorkOut: number; // 분
}

const cases: Case[] = [
  { no: 1, ym: [2026, 10], total: [155, 52], holidayWork: [0, 0], mode: "separate", holidayCount: 1, base: "165h 00m", overtime: "0h 00m", remaining: "9h 08m", holidayWorkOut: 0 },
  { no: 2, ym: [2026, 10], total: [180, 30], holidayWork: [0, 0], mode: "separate", holidayCount: 1, base: "165h 00m", overtime: "15h 30m", overtimeDecimal: "15.50", remaining: "0h 00m", holidayWorkOut: 0 },
  { no: 3, ym: [2026, 10], total: [175, 10], holidayWork: [6, 0], mode: "separate", holidayCount: 1, base: "165h 00m", overtime: "4h 10m", overtimeDecimal: "4.17", remaining: "0h 00m", holidayWorkOut: 360 },
  { no: 4, ym: [2026, 2], total: [160, 0], holidayWork: [0, 0], mode: "separate", holidayCount: 3, base: "149h 00m", overtime: "11h 00m", remaining: "0h 00m", holidayWorkOut: 0 },
  { no: 5, ym: [2026, 5], total: [0, 52], holidayWork: [0, 0], mode: "separate", holidayCount: 2, base: "157h 00m", overtime: "0h 00m", remaining: "156h 08m", holidayWorkOut: 0 },
  { no: 6, ym: [2026, 6], total: [170, 30], holidayWork: [8, 30], mode: "separate", holidayCount: 1, base: "165h 00m", overtime: "0h 00m", remaining: "3h 00m", holidayWorkOut: 510 },
  { no: 7, ym: [2027, 10], total: [173, 1], holidayWork: [0, 0], mode: "separate", holidayCount: 0, base: "173h 00m", overtime: "0h 01m", overtimeDecimal: "0.02", remaining: "0h 00m", holidayWorkOut: 0 },
  { no: 8, ym: [2026, 10], total: [175, 10], holidayWork: [6, 0], mode: "include", holidayCount: 1, base: "165h 00m", overtime: "10h 10m", remaining: "0h 00m", holidayWorkOut: 360 },
  { no: 9, ym: [2026, 10], total: [5, 0], holidayWork: [8, 0], mode: "separate", holidayCount: 1, base: "165h 00m", overtime: "0h 00m", remaining: "165h 00m", holidayWorkOut: 480 },
];

describe("작업 지시서 테스트 케이스", () => {
  it.each(cases)("케이스 $no", (c) => {
    const [y, m] = c.ym;
    const count = weekdayHolidays(holidays, y, m).length;
    expect(count).toBe(c.holidayCount);

    const r = calculateOvertime(
      {
        totalMinutes: toMinutes(...c.total),
        holidayWorkMinutes: toMinutes(...c.holidayWork),
        weekdayHolidayCount: count,
      },
      { ...DEFAULT_SETTINGS, holidayWorkMode: c.mode },
    );

    expect(formatHM(r.baseMinutes)).toBe(c.base);
    expect(formatHM(r.overtimeMinutes)).toBe(c.overtime);
    expect(formatHM(r.remainingMinutes)).toBe(c.remaining);
    expect(r.holidayWorkMinutes).toBe(c.holidayWorkOut);
    if (c.overtimeDecimal) expect(formatDecimalHours(r.overtimeMinutes)).toBe(c.overtimeDecimal);
    expect(r.overtimeMinutes).toBeGreaterThanOrEqual(0);
    expect(r.remainingMinutes).toBeGreaterThanOrEqual(0);
  });
});

describe("평일공휴일 판정", () => {
  const names = (y: number, m: number) => weekdayHolidays(holidays, y, m).map((h) => h.name);

  it("주말 공휴일과 대체공휴일은 빼지 않는다 (2026-10)", () => {
    expect(names(2026, 10)).toEqual(["한글날"]);
  });
  it("5월: 노동절·어린이날만 센다", () => {
    expect(names(2026, 5)).toEqual(["노동절", "어린이날"]);
  });
  it("6월: 지방선거만 센다", () => {
    expect(names(2026, 6)).toEqual(["전국동시지방선거"]);
  });
  it("표시 라벨", () => {
    expect(formatHolidayLabel(weekdayHolidays(holidays, 2026, 10)[0])).toBe("10/9(금) 한글날");
  });
  it("목록에 없는 연도", () => {
    expect(hasHolidayData(holidays, 2026)).toBe(true);
    expect(hasHolidayData(holidays, 2028)).toBe(false);
    expect(weekdayHolidays(holidays, 2028, 1)).toEqual([]);
  });
});

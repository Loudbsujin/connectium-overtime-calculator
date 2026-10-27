// 추가근로시간 계산 로직 (회사 내규, 월 기준시간 방식)
// 모든 계산은 분 단위 정수로 한다. 소수 시간은 표시용으로만 쓴다.

export type HolidayType = "공휴일" | "대체공휴일";

export interface Holiday {
  date: string; // YYYY-MM-DD
  name: string;
  type: HolidayType | string;
}

export type HolidayWorkMode = "separate" | "include";

export interface Settings {
  /** 월 기준시간(시) */
  monthlyBaseHours: number;
  /** 평일공휴일 1일당 차감(시) */
  deductHoursPerHoliday: number;
  /** 평일공휴일 근무 처리: 휴일근로로 분리 / 합계에 포함 */
  holidayWorkMode: HolidayWorkMode;
}

export const DEFAULT_SETTINGS: Settings = {
  monthlyBaseHours: 173,
  deductHoursPerHoliday: 8,
  holidayWorkMode: "separate",
};

export interface WeekdayHoliday extends Holiday {
  month: number;
  day: number;
  /** 0=일 … 6=토 */
  dayOfWeek: number;
}

const DOW_KO = ["일", "월", "화", "수", "목", "금", "토"];

/** "YYYY-MM-DD"를 로컬 날짜로 해석한다. new Date("YYYY-MM-DD")는 UTC로 해석되므로 쓰지 않는다. */
export function parseYmd(date: string): { y: number; m: number; d: number; dayOfWeek: number } {
  const [y, m, d] = date.split("-").map(Number);
  return { y, m, d, dayOfWeek: new Date(y, m - 1, d).getDay() };
}

/** 해당 연도의 공휴일 목록이 데이터에 있는지 */
export function hasHolidayData(holidays: Holiday[], year: number): boolean {
  const prefix = `${year}-`;
  return holidays.some((h) => h.date.startsWith(prefix));
}

/** 해당 월의 공휴일 중 월~금이고 대체공휴일이 아닌 날 */
export function weekdayHolidays(holidays: Holiday[], year: number, month: number): WeekdayHoliday[] {
  return holidays
    .map((h) => ({ h, p: parseYmd(h.date) }))
    .filter(({ h, p }) => p.y === year && p.m === month && h.type !== "대체공휴일" && p.dayOfWeek >= 1 && p.dayOfWeek <= 5)
    .sort((a, b) => a.p.d - b.p.d)
    .map(({ h, p }) => ({ ...h, month: p.m, day: p.d, dayOfWeek: p.dayOfWeek }));
}

/** "10/9(금) 한글날" */
export function formatHolidayLabel(h: WeekdayHoliday): string {
  return `${h.month}/${h.day}(${DOW_KO[h.dayOfWeek]}) ${h.name}`;
}

export function toMinutes(hours: number, minutes: number): number {
  return Math.round((hours || 0) * 60) + Math.round(minutes || 0);
}

export interface OvertimeInput {
  totalMinutes: number;
  holidayWorkMinutes: number;
  weekdayHolidayCount: number;
}

export interface OvertimeResult {
  baseMinutes: number;
  deductedMinutes: number;
  compareMinutes: number;
  overtimeMinutes: number;
  remainingMinutes: number;
  holidayWorkMinutes: number;
}

export function calculateOvertime(input: OvertimeInput, settings: Settings = DEFAULT_SETTINGS): OvertimeResult {
  const totalMinutes = Math.max(0, input.totalMinutes);
  const holidayWorkMinutes = Math.max(0, input.holidayWorkMinutes);

  const deductedMinutes = Math.round(input.weekdayHolidayCount * settings.deductHoursPerHoliday * 60);
  const baseMinutes = Math.max(0, Math.round(settings.monthlyBaseHours * 60) - deductedMinutes);

  const compareMinutes =
    settings.holidayWorkMode === "separate" ? Math.max(0, totalMinutes - holidayWorkMinutes) : totalMinutes;

  return {
    baseMinutes,
    deductedMinutes,
    compareMinutes,
    overtimeMinutes: Math.max(0, compareMinutes - baseMinutes),
    remainingMinutes: Math.max(0, baseMinutes - compareMinutes),
    holidayWorkMinutes,
  };
}

/** 165h 00m */
export function formatHM(totalMinutes: number): string {
  const m = Math.max(0, Math.round(totalMinutes));
  return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, "0")}m`;
}

/** 분이 0이면 "165h", 아니면 "165h 30m" */
export function formatHoursShort(totalMinutes: number): string {
  return totalMinutes % 60 === 0 ? `${totalMinutes / 60}h` : formatHM(totalMinutes);
}

/** 소수 시간, 둘째 자리 반올림: 250분 → "4.17" */
export function formatDecimalHours(totalMinutes: number): string {
  return (Math.round((totalMinutes * 100) / 60) / 100).toFixed(2);
}

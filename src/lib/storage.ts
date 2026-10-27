// 브라우저 localStorage 저장. 서버로 보내지 않는다.
import { DEFAULT_SETTINGS, type Settings } from "./overtime";

const SETTINGS_KEY = "connectium-overtime:settings:v1";
const RECORDS_KEY = "connectium-overtime:records:v1";

export interface MonthRecord {
  /** YYYY-MM */
  ym: string;
  totalMinutes: number;
  holidayWorkMinutes: number;
  baseMinutes: number;
  overtimeMinutes: number;
  savedAt: string;
}

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // 저장 불가(사생활 보호 모드 등) — 화면은 그대로 동작
  }
}

export function loadSettings(): Settings {
  const s = readJson<Partial<Settings>>(SETTINGS_KEY, {});
  return {
    monthlyBaseHours: Number.isFinite(s.monthlyBaseHours) ? s.monthlyBaseHours! : DEFAULT_SETTINGS.monthlyBaseHours,
    deductHoursPerHoliday: Number.isFinite(s.deductHoursPerHoliday)
      ? s.deductHoursPerHoliday!
      : DEFAULT_SETTINGS.deductHoursPerHoliday,
    holidayWorkMode: s.holidayWorkMode === "include" ? "include" : "separate",
  };
}

export function saveSettings(settings: Settings): void {
  writeJson(SETTINGS_KEY, settings);
}

export function loadRecords(): MonthRecord[] {
  const list = readJson<MonthRecord[]>(RECORDS_KEY, []);
  return Array.isArray(list) ? sortRecords(list.filter((r) => r && typeof r.ym === "string")) : [];
}

export function saveRecords(records: MonthRecord[]): void {
  writeJson(RECORDS_KEY, records);
}

/** 같은 연월이면 덮어쓴다 */
export function upsertRecord(records: MonthRecord[], record: MonthRecord): MonthRecord[] {
  return sortRecords([...records.filter((r) => r.ym !== record.ym), record]);
}

function sortRecords(records: MonthRecord[]): MonthRecord[] {
  return [...records].sort((a, b) => b.ym.localeCompare(a.ym));
}

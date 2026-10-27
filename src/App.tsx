import { useEffect, useMemo, useState } from "react";
import holidaysJson from "./data/holidays.json";
import {
  calculateOvertime,
  DEFAULT_SETTINGS,
  formatDecimalHours,
  formatHM,
  formatHolidayLabel,
  formatHoursShort,
  hasHolidayData,
  type Holiday,
  type Settings,
  toMinutes,
  weekdayHolidays,
} from "./lib/overtime";
import { loadRecords, loadSettings, type MonthRecord, saveRecords, saveSettings, upsertRecord } from "./lib/storage";

const holidays = holidaysJson as Holiday[];

function currentYm(): { year: number; month: number } {
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() + 1 };
}

const ymKey = (year: number, month: number) => `${year}-${String(month).padStart(2, "0")}`;
const ymLabel = (ym: string) => {
  const [y, m] = ym.split("-").map(Number);
  return `${y}년 ${m}월`;
};

/** 숫자만 남긴다 */
const digitsOnly = (v: string, maxLen: number) => v.replace(/\D/g, "").slice(0, maxLen);
const num = (v: string) => (v === "" ? 0 : Number(v));

interface HMValue {
  h: string;
  m: string;
}
const EMPTY_HM: HMValue = { h: "", m: "" };
const fromMinutes = (min: number): HMValue => (min > 0 ? { h: String(Math.floor(min / 60)), m: String(min % 60) } : EMPTY_HM);

function HMInput({ id, label, value, onChange, hint }: { id: string; label: string; value: HMValue; onChange: (v: HMValue) => void; hint?: string }) {
  const minuteInvalid = num(value.m) > 59;
  return (
    <div className="field">
      <label className="field-label" htmlFor={`${id}-h`}>
        {label}
      </label>
      {hint && <p className="field-hint">{hint}</p>}
      <div className="hm">
        <div className="hm-cell">
          <input
            id={`${id}-h`}
            className="num-input"
            type="text"
            inputMode="numeric"
            autoComplete="off"
            placeholder="0"
            value={value.h}
            onChange={(e) => onChange({ ...value, h: digitsOnly(e.target.value, 3) })}
            aria-label={`${label} 시`}
          />
          <span className="unit">시간</span>
        </div>
        <div className="hm-cell">
          <input
            id={`${id}-m`}
            className={`num-input${minuteInvalid ? " invalid" : ""}`}
            type="text"
            inputMode="numeric"
            autoComplete="off"
            placeholder="0"
            value={value.m}
            onChange={(e) => onChange({ ...value, m: digitsOnly(e.target.value, 2) })}
            aria-label={`${label} 분`}
            aria-invalid={minuteInvalid}
          />
          <span className="unit">분</span>
        </div>
      </div>
      {minuteInvalid && <p className="field-error">분은 0~59 사이로 입력해 주세요.</p>}
    </div>
  );
}

export default function App() {
  const [{ year, month }, setYm] = useState(currentYm);
  const [total, setTotal] = useState<HMValue>(EMPTY_HM);
  const [holidayWork, setHolidayWork] = useState<HMValue>(EMPTY_HM);
  const [holidayOpen, setHolidayOpen] = useState(false);
  const [settings, setSettings] = useState<Settings>(loadSettings);
  const [records, setRecords] = useState<MonthRecord[]>(loadRecords);
  const [toast, setToast] = useState("");

  useEffect(() => saveSettings(settings), [settings]);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 2400);
    return () => clearTimeout(t);
  }, [toast]);

  const ym = ymKey(year, month);
  const hasData = hasHolidayData(holidays, year);
  const monthHolidays = useMemo(() => weekdayHolidays(holidays, year, month), [year, month]);

  const totalMinutes = toMinutes(num(total.h), num(total.m));
  const holidayWorkMinutes = monthHolidays.length > 0 ? toMinutes(num(holidayWork.h), num(holidayWork.m)) : 0;
  const invalid = num(total.m) > 59 || (monthHolidays.length > 0 && num(holidayWork.m) > 59);
  const totalEntered = total.h !== "" || total.m !== "";

  const result = calculateOvertime(
    { totalMinutes, holidayWorkMinutes, weekdayHolidayCount: monthHolidays.length },
    settings,
  );

  const baseLine = (() => {
    const start = `${formatHoursShort(Math.round(settings.monthlyBaseHours * 60))}`;
    const end = formatHoursShort(result.baseMinutes);
    if (monthHolidays.length === 0) return `${start} (차감 없음)`;
    const deduct = formatHoursShort(result.deductedMinutes);
    const who = monthHolidays.length === 1 ? monthHolidays[0].name : `평일공휴일 ${monthHolidays.length}일`;
    return `${start} − ${who} ${deduct} = ${end}`;
  })();

  const shiftMonth = (delta: number) => {
    setYm(({ year: y, month: m }) => {
      const d = new Date(y, m - 1 + delta, 1);
      return { year: d.getFullYear(), month: d.getMonth() + 1 };
    });
  };
  const today = currentYm();
  const isThisMonth = today.year === year && today.month === month;

  const handleSave = () => {
    if (invalid || !totalEntered) return;
    const existed = records.some((r) => r.ym === ym);
    const next = upsertRecord(records, {
      ym,
      totalMinutes,
      holidayWorkMinutes,
      baseMinutes: result.baseMinutes,
      overtimeMinutes: result.overtimeMinutes,
      savedAt: new Date().toISOString(),
    });
    setRecords(next);
    saveRecords(next);
    setToast(existed ? `${ymLabel(ym)} 기록을 덮어썼습니다` : `${ymLabel(ym)} 기록을 저장했습니다`);
  };

  const handleDelete = (target: string) => {
    if (!window.confirm(`${ymLabel(target)} 기록을 삭제할까요?`)) return;
    const next = records.filter((r) => r.ym !== target);
    setRecords(next);
    saveRecords(next);
  };

  const handleLoad = (r: MonthRecord) => {
    const [y, m] = r.ym.split("-").map(Number);
    setYm({ year: y, month: m });
    setTotal(fromMinutes(r.totalMinutes));
    setHolidayWork(fromMinutes(r.holidayWorkMinutes));
    setHolidayOpen(r.holidayWorkMinutes > 0);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const updateSetting = <K extends keyof Settings>(key: K, value: Settings[K]) =>
    setSettings((s) => ({ ...s, [key]: value }));

  return (
    <main className="page">
      <header className="header">
        <h1>추가근로시간 계산기</h1>
        <p>월 {formatHoursShort(Math.round(settings.monthlyBaseHours * 60))} 기준 · 설정과 기록은 이 브라우저에만 저장됩니다</p>
      </header>

      <section className="card" aria-labelledby="input-title">
        <h2 id="input-title" className="sr-only">
          입력
        </h2>

        <div className="month-stepper">
          <button type="button" className="icon-btn" onClick={() => shiftMonth(-1)} aria-label="이전 달">
            ‹
          </button>
          <div className="month-label">
            <strong>
              {year}년 {month}월
            </strong>
            {!isThisMonth && (
              <button type="button" className="link-btn" onClick={() => setYm(currentYm())}>
                이번 달로
              </button>
            )}
          </div>
          <button type="button" className="icon-btn" onClick={() => shiftMonth(1)} aria-label="다음 달">
            ›
          </button>
        </div>

        {!hasData && <p className="notice">이 연도 공휴일 목록이 없어 차감 없이 계산했습니다.</p>}

        <HMInput id="total" label="총 근로시간" hint="다우오피스 근태 화면의 '총 근로시간'을 그대로 입력하세요" value={total} onChange={setTotal} />

        {monthHolidays.length > 0 && (
          <div className="holiday-box">
            <div className="holiday-head">
              <div>
                <span className="holiday-title">이 달 평일공휴일</span>
                <ul className="chips">
                  {monthHolidays.map((h) => (
                    <li key={h.date} className="chip">
                      {formatHolidayLabel(h)}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            <button type="button" className="toggle-btn" aria-expanded={holidayOpen} onClick={() => setHolidayOpen((o) => !o)}>
              <span>
                평일공휴일에 일했나요?
                {!holidayOpen && holidayWorkMinutes > 0 && <em> 입력됨 {formatHM(holidayWorkMinutes)}</em>}
              </span>
              <span className="chevron" aria-hidden>
                {holidayOpen ? "−" : "+"}
              </span>
            </button>
            {holidayOpen && (
              <HMInput
                id="holiday"
                label="평일공휴일 근무시간"
                hint={
                  settings.holidayWorkMode === "separate"
                    ? "총 근로시간에서 빼고 '휴일근로'로 따로 보여줍니다"
                    : "설정에 따라 총 근로시간에 포함해 계산합니다"
                }
                value={holidayWork}
                onChange={setHolidayWork}
              />
            )}
          </div>
        )}
      </section>

      <section className="card result" aria-labelledby="result-title" aria-live="polite">
        <h2 id="result-title" className="result-caption">
          {month}월 연장근로시간
        </h2>
        {invalid ? (
          <p className="result-main muted">—</p>
        ) : (
          <>
            <p className={`result-main${result.overtimeMinutes > 0 ? " positive" : ""}`}>{formatHM(result.overtimeMinutes)}</p>
            <p className="result-sub">{formatDecimalHours(result.overtimeMinutes)}시간</p>
          </>
        )}

        <dl className="result-rows">
          <div className="row">
            <dt>이 달 기준시간</dt>
            <dd>
              <span className="row-value">{formatHM(result.baseMinutes)}</span>
              <span className="row-note">{baseLine}</span>
            </dd>
          </div>
          <div className="row">
            <dt>기준까지 남은 시간</dt>
            <dd>
              <span className="row-value">{invalid ? "—" : formatHM(result.remainingMinutes)}</span>
            </dd>
          </div>
          {!invalid && result.holidayWorkMinutes > 0 && (
            <div className="row">
              <dt>휴일근로시간</dt>
              <dd>
                <span className="row-value">{formatHM(result.holidayWorkMinutes)}</span>
                <span className="row-note">
                  {settings.holidayWorkMode === "separate" ? "연장근로와 별도" : "연장근로 계산에 포함됨"}
                </span>
              </dd>
            </div>
          )}
        </dl>

        <button type="button" className="primary-btn" onClick={handleSave} disabled={invalid || !totalEntered}>
          {isThisMonth ? "이번 달" : `${month}월`} 기록 저장
        </button>
        <p className="toast" role="status">
          {toast}
        </p>
      </section>

      <section className="card" aria-labelledby="records-title">
        <h2 id="records-title" className="section-title">
          월별 기록
        </h2>
        {records.length === 0 ? (
          <p className="empty">저장한 기록이 없습니다.</p>
        ) : (
          <ul className="records">
            {records.map((r) => (
              <li key={r.ym} className={`record${r.ym === ym ? " current" : ""}`}>
                <button type="button" className="record-main" onClick={() => handleLoad(r)} title="불러오기">
                  <span className="record-ym">{ymLabel(r.ym)}</span>
                  <span className="record-meta">총 {formatHM(r.totalMinutes)}</span>
                  <span className="record-ot">
                    연장 <strong>{formatHM(r.overtimeMinutes)}</strong>
                  </span>
                </button>
                <button type="button" className="delete-btn" onClick={() => handleDelete(r.ym)} aria-label={`${ymLabel(r.ym)} 기록 삭제`}>
                  삭제
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <details className="card settings">
        <summary className="section-title">설정</summary>
        <div className="settings-body">
          <label className="setting">
            <span>월 기준시간</span>
            <span className="setting-input">
              <input
                type="number"
                inputMode="decimal"
                min={0}
                step={1}
                value={settings.monthlyBaseHours}
                onChange={(e) => updateSetting("monthlyBaseHours", Math.max(0, Number(e.target.value) || 0))}
              />
              시간
            </span>
          </label>
          <label className="setting">
            <span>평일공휴일 1일당 차감</span>
            <span className="setting-input">
              <input
                type="number"
                inputMode="decimal"
                min={0}
                step={1}
                value={settings.deductHoursPerHoliday}
                onChange={(e) => updateSetting("deductHoursPerHoliday", Math.max(0, Number(e.target.value) || 0))}
              />
              시간
            </span>
          </label>
          <fieldset className="setting radio-set">
            <legend>평일공휴일 근무 처리</legend>
            <label>
              <input
                type="radio"
                name="mode"
                checked={settings.holidayWorkMode === "separate"}
                onChange={() => updateSetting("holidayWorkMode", "separate")}
              />
              휴일근로로 분리 <small>(기본)</small>
            </label>
            <label>
              <input
                type="radio"
                name="mode"
                checked={settings.holidayWorkMode === "include"}
                onChange={() => updateSetting("holidayWorkMode", "include")}
              />
              합계에 포함
            </label>
          </fieldset>
          <button type="button" className="link-btn" onClick={() => setSettings(DEFAULT_SETTINGS)}>
            기본값으로 되돌리기
          </button>
        </div>
      </details>

      <footer className="footer">
        주말과 겹친 공휴일·대체공휴일은 차감하지 않습니다. 서버로 전송되는 정보는 없습니다.
      </footer>
    </main>
  );
}

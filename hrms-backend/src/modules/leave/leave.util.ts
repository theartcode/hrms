import { enumerateISTDateStrings, getISTDateString } from "../../shared/utils/istDate";
import { isConfiguredWeekend } from "../configuration/configuration.cache";
import { HolidayModel } from "../holiday/holiday.model";

/**
 * Working-day count within [startDate, endDate], inclusive — excludes
 * Sundays and active company holidays, since spending leave balance on a
 * day off you already have doesn't make sense. Mirrors the same weekend/
 * holiday rules the attendance engine uses (Phase 4), so the two never
 * disagree about which days are "working days."
 *
 * `includeWeekends` (per-leave-type policy, Leave Policy settings) counts
 * weekend days toward the total instead of skipping them — holidays are
 * still always excluded regardless.
 */
export async function computeLeaveWorkingDays(
  startDate: string,
  endDate: string,
  includeWeekends = false
): Promise<number> {
  const dateStrings = enumerateISTDateStrings(startDate, endDate);

  const holidays = await HolidayModel.find({
    isActive: true,
    date: { $gte: startDate, $lte: endDate },
  }).select("date");
  const holidayDates = new Set(holidays.map((h) => h.date));

  let count = 0;
  for (const dateStr of dateStrings) {
    const isWeekend = isConfiguredWeekend(new Date(`${dateStr}T12:00:00+05:30`));
    if ((includeWeekends || !isWeekend) && !holidayDates.has(dateStr)) {
      count += 1;
    }
  }
  return count;
}

function monthKeyAdd(monthKey: string, delta: number): string {
  const [y, m] = monthKey.split("-").map(Number);
  let year = y;
  let month = m + delta;
  while (month > 12) {
    month -= 12;
    year += 1;
  }
  while (month < 1) {
    month += 12;
    year -= 1;
  }
  return `${year}-${String(month).padStart(2, "0")}`;
}

/**
 * Counts fully-completed calendar months within `year`, from the month
 * `permanentSince` falls in (or January of `year`, whichever is later)
 * through the last month fully passed before `asOfDateStr` — the current
 * calendar month never counts yet, since accrual only credits once a month
 * has fully passed. Returns 0 for an employee who isn't Permanent at all
 * (permanentSince is null) or wasn't yet Permanent at any point in `year`.
 *
 * This only counts *eligible months* — it doesn't credit anything by
 * itself. leave.service.ts's creditAnnualAccrual diffs this against a
 * LeaveBalance's stored annualAccruedThroughMonth to find out how many
 * *new* months to credit, so calling this repeatedly is always safe.
 */
export function countEligibleAccrualMonths(
  permanentSince: Date | null,
  year: number,
  asOfDateStr: string
): number {
  if (!permanentSince) return 0;

  const yearStartMonthKey = `${year}-01`;
  const yearEndMonthKey = `${year}-12`;
  const permanentMonthKey = getISTDateString(permanentSince).slice(0, 7);
  const startMonthKey = permanentMonthKey > yearStartMonthKey ? permanentMonthKey : yearStartMonthKey;

  const currentMonthKey = asOfDateStr.slice(0, 7);
  const lastCompleteMonthKey =
    currentMonthKey > yearEndMonthKey ? yearEndMonthKey : monthKeyAdd(currentMonthKey, -1);

  if (startMonthKey > lastCompleteMonthKey || lastCompleteMonthKey < yearStartMonthKey) {
    return 0;
  }

  let count = 0;
  for (let cursor = startMonthKey; cursor <= lastCompleteMonthKey; cursor = monthKeyAdd(cursor, 1)) {
    count += 1;
  }
  return count;
}

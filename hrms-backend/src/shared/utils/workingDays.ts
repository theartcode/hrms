import { HolidayModel } from "../../modules/holiday/holiday.model";
import { getISTDateString, getISTDayOfWeek } from "./istDate";

// The single place "non-working day" is defined — Sat/Sun today, but kept
// as one small function rather than inlined everywhere so a future
// variable work-week can change just this. Combined with active Holiday
// records (below) rather than weekends alone, per the Work Schedule
// brief's own instruction to keep this reusable instead of hardcoding
// Mon-Fri throughout the app.
function isWeekend(date: Date): boolean {
  const day = getISTDayOfWeek(date);
  return day === 0 || day === 6;
}

// Bounded lookahead so the Holiday query never has to be open-ended — at
// most a handful of holidays could plausibly fall inside even a generous
// window, so this comfortably covers `count` working days for any
// realistic holiday density.
const HOLIDAY_LOOKAHEAD_PADDING_DAYS = 30;

async function getActiveHolidayDates(from: string, count: number): Promise<Set<string>> {
  const cursor = new Date(`${from}T00:00:00+05:30`);
  cursor.setUTCDate(cursor.getUTCDate() + count + HOLIDAY_LOOKAHEAD_PADDING_DAYS);
  const end = getISTDateString(cursor);

  const holidays = await HolidayModel.find({
    date: { $gte: from, $lte: end },
    isActive: true,
  }).select("date");

  return new Set(holidays.map((h) => h.date));
}

/**
 * The next `count` working days (Mon-Fri, excluding active Holidays),
 * starting from `from` (inclusive) — "today" counts as the first working
 * day when it qualifies, so a planning grid built the same morning still
 * includes today.
 */
export async function getNextWorkingDays(
  count: number,
  from: string = getISTDateString()
): Promise<string[]> {
  const holidays = await getActiveHolidayDates(from, count);
  const result: string[] = [];
  const cursor = new Date(`${from}T00:00:00+05:30`);

  while (result.length < count) {
    const dateStr = getISTDateString(cursor);
    if (!isWeekend(cursor) && !holidays.has(dateStr)) {
      result.push(dateStr);
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return result;
}

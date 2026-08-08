const IST_TIMEZONE = "Asia/Kolkata";

export function getISTDateString(date: Date = new Date()): string {
  return date.toLocaleDateString("en-CA", { timeZone: IST_TIMEZONE });
}

export function formatISTTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("en-IN", {
    timeZone: IST_TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

export function formatISTDate(dateStr: string): string {
  // dateStr is either a plain "YYYY-MM-DD" (attendance/holiday records) or
  // a full ISO timestamp (Mongoose Date fields like dateOfBirth/joiningDate,
  // serialized with a trailing "Z"). Appending a time+offset onto an
  // already-full timestamp produces an unparseable string ("...ZT12:00...")
  // — only pad the time when it isn't there yet.
  const iso = dateStr.includes("T") ? dateStr : `${dateStr}T12:00:00+05:30`;
  return new Date(iso).toLocaleDateString("en-IN", {
    timeZone: IST_TIMEZONE,
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function formatWorkedHours(hours: number | null): string {
  if (hours === null || hours === undefined) return "—";
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return `${h}h ${m}m`;
}

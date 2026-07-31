// Generalized from the Adobe License import feature
// (features/administration/components/adobe-license-import.ts), which had
// the same "parse a CSV or XLSX into a rectangular string grid" need. That
// file still owns its own copy (its cell-shape/richText handling is
// specific to license-sheet exports) — this is the shared version for any
// new feature that just needs "first row headers, rest data rows."

// RFC4180-ish CSV parser (quoted fields, escaped "" quotes, CRLF/LF) — kept
// dependency-free since it's the common case and doesn't need a library.
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows.filter((r) => r.some((cell) => cell.trim() !== ""));
}

function cellToString(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "object") {
    const v = value as { text?: unknown; result?: unknown; richText?: { text: string }[] };
    if (Array.isArray(v.richText)) return v.richText.map((t) => t.text).join("");
    if (v.text !== undefined) return String(v.text);
    if (v.result !== undefined) return String(v.result);
    return "";
  }
  return String(value);
}

// exceljs is loaded lazily — its browser bundle is a few hundred KB and
// most imports will be plain CSV, so paying that cost only when someone
// actually picks a .xlsx/.xls file keeps the base bundle lean.
async function parseXlsx(file: File): Promise<string[][]> {
  const ExcelJS = (await import("exceljs")).default;
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await file.arrayBuffer());

  const worksheet = workbook.worksheets[0];
  if (!worksheet) return [];

  const rows: string[][] = [];
  worksheet.eachRow({ includeEmpty: false }, (row) => {
    const values = row.values as unknown[]; // 1-indexed; values[0] is unused
    rows.push(values.slice(1).map(cellToString));
  });
  return rows;
}

/** First row is treated as headers, the rest as data. Trailing blank rows are dropped. */
export async function parseImportFile(file: File): Promise<string[][]> {
  const name = file.name.toLowerCase();
  const table = name.endsWith(".csv") ? parseCsv(await file.text()) : await parseXlsx(file);

  // Pad every row out to the widest row so the sheet stays rectangular.
  const width = table.reduce((max, row) => Math.max(max, row.length), 0);
  return table.map((row) => {
    const padded = [...row];
    while (padded.length < width) padded.push("");
    return padded;
  });
}

/** Splits a parsed table into a header row + the rest, trimming header cells. */
export function splitHeaderAndRows(table: string[][]): { headers: string[]; rows: string[][] } {
  const [headerRow, ...rows] = table;
  return { headers: (headerRow ?? []).map((h) => h.trim()), rows };
}

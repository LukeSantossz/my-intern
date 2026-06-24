import { readFile } from "node:fs/promises";
import path from "node:path";
import ExcelJS from "exceljs";

// Read tabular data from a .csv or .xlsx file into row objects keyed by header.
export async function readRows(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".csv") return readCsv(filePath);
  if (ext === ".xlsx") return readXlsx(filePath);
  throw new Error(`Unsupported spreadsheet type "${ext}" (expected .csv or .xlsx): ${filePath}`);
}

// Read a CSV file into header-keyed row objects, ignoring a leading UTF-8 BOM.
async function readCsv(filePath) {
  const text = await readFile(filePath, "utf8");
  // A BOM at file start (common in Excel exports) must not leak into the first key.
  const records = parseCsv(text.replace(/^\uFEFF/, ""));
  if (records.length === 0) return [];
  const [header, ...rows] = records;
  return rows.map((cells) => toObject(header, cells));
}

// Read the first worksheet of an .xlsx file into header-keyed row objects.
async function readXlsx(filePath) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  const sheet = workbook.worksheets[0];
  if (!sheet) return [];
  const rows = [];
  let header = null;
  sheet.eachRow((row) => {
    const cells = (row.values || []).slice(1).map((value) => (value == null ? "" : String(value)));
    if (!header) {
      header = cells;
      return;
    }
    rows.push(toObject(header, cells));
  });
  return rows;
}

// Zip a header row and a cell row into an object, skipping unnamed columns.
function toObject(header, cells) {
  const obj = {};
  header.forEach((key, index) => {
    const name = key == null ? "" : String(key).trim();
    if (name !== "") obj[name] = (cells[index] ?? "").toString();
  });
  return obj;
}

// Minimal RFC 4180 CSV parser: handles quoted fields, escaped quotes (""),
// and commas or newlines inside quotes. Skips blank lines.
export function parseCsv(text) {
  const records = [];
  let row = [];
  let field = "";
  let inQuotes = false;

  const endField = () => {
    row.push(field);
    field = "";
  };
  const endRow = () => {
    endField();
    if (row.length > 1 || row[0] !== "") records.push(row);
    row = [];
  };

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
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      endField();
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[i + 1] === "\n") i++;
      endRow();
    } else {
      field += char;
    }
  }
  if (inQuotes) {
    throw new Error("Malformed CSV: unterminated quoted field");
  }
  if (field !== "" || row.length > 0) endRow();
  return records;
}

import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import ExcelJS from "exceljs";
import { readRows } from "../lib/spreadsheet.mjs";

test("reads_all_rows_from_sample_spreadsheet", async () => {
  const tmp = await mkdtemp(path.join(os.tmpdir(), "filler-sheet-"));
  try {
    // CSV, including a value with a quoted comma to exercise the parser.
    const csv = path.join(tmp, "data.csv");
    await writeFile(csv, 'id,nome,obs\n1,Ana,"Rua A, 10"\n2,Bea,ok\n3,Caio,ok\n');
    const csvRows = await readRows(csv);
    assert.equal(csvRows.length, 3);
    assert.equal(csvRows[0].nome, "Ana");
    assert.equal(csvRows[0].obs, "Rua A, 10");

    // XLSX with the same shape.
    const xlsxPath = path.join(tmp, "data.xlsx");
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("s");
    ws.addRow(["id", "nome", "obs"]);
    ws.addRow([1, "Ana", "Rua A, 10"]);
    ws.addRow([2, "Bea", "ok"]);
    ws.addRow([3, "Caio", "ok"]);
    await wb.xlsx.writeFile(xlsxPath);
    const xlsxRows = await readRows(xlsxPath);
    assert.equal(xlsxRows.length, 3);
    assert.equal(xlsxRows[0].nome, "Ana");
    assert.equal(xlsxRows[2].nome, "Caio");
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
});

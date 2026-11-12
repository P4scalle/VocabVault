// @vitest-environment jsdom
import { TestBed } from '@angular/core/testing';
import { BulkParseService } from './bulk-parse.service';
import * as XLSX from 'xlsx';

// jsdom does not implement File.prototype.arrayBuffer, so polyfill it so the
// service's `await file.arrayBuffer()` resolves to the file's bytes.
if (!File.prototype.arrayBuffer) {
  File.prototype.arrayBuffer = function (): Promise<ArrayBuffer> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as ArrayBuffer);
      reader.onerror = () => reject(reader.error);
      reader.readAsArrayBuffer(this);
    });
  };
}

describe('BulkParseService parseFile .xlsx branch', () => {
  let service: BulkParseService;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [BulkParseService] });
    service = TestBed.inject(BulkParseService);
  });

  it('round-trip: valid workbook returns word/definition rows', async () => {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([
      ['word', 'definition'],
      ['hola', 'hello'],
      ['adios', 'goodbye'],
    ]);
    XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
    const bytes = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
    const file = new File([bytes], 'words.xlsx');

    const res = await service.parseFile(file);

    if (res.ok) {
      const data = res.result.data;
      expect(res.ok).toBe(true);
      // Service filters rows where row[0] is truthy, so header and data rows all qualify
      const firstCols = data.map((row) => row[0]);
      expect(firstCols).toContain('hola');
      expect(firstCols).toContain('adios');
      // Check full rows are present
      expect(data.some((row) => row[0] === 'hola' && row[1] === 'hello')).toBe(true);
      expect(data.some((row) => row[0] === 'adios' && row[1] === 'goodbye')).toBe(true);
    } else {
      throw new Error('Expected ok:true but got ok:false: ' + res.error);
    }
  });

  it('error path: corrupt .xlsx bytes return ok:false with readable error', async () => {
    // xlsx (SheetJS) accepts arbitrary byte arrays as sheets but rejects ZIP-like
    // structures with invalid headers, so use PK magic + 0xFF bytes to force a throw.
    const corruptZip = new Uint8Array([
      0x50, 0x4b, 0x03, 0x04, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff,
    ]);
    const file = new File([corruptZip], 'bad.xlsx');

    const res = await service.parseFile(file);

    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error).toMatch(/Could not read \.xlsx file/);
    }
  });

  it('unsupported extension: .pdf file is rejected before reaching xlsx branch', async () => {
    const file = new File(['x'], 'f.pdf');

    const res = await service.parseFile(file);

    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error).toMatch(/[Uu]nsupported/);
    }
  });
});

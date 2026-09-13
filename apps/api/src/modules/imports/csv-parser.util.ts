import { MAX_IMPORT_ROWS } from './imports.constants';

export interface ParsedCsvResult {
  headers: string[];
  normalizedHeaders: string[];
  headerMap: Record<string, string>; // normalized -> original
  rows: Array<{
    rowNumber: number;
    data: Record<string, string>;
  }>;
  totalRows: number;
}

export class CsvParserUtil {
  /**
   * Strips UTF-8 BOM character (\uFEFF) from the beginning of string if present.
   */
  public static stripBom(content: string): string {
    if (content.charCodeAt(0) === 0xfeff) {
      return content.slice(1);
    }
    return content;
  }

  /**
   * Normalizes header key for flexible matching (e.g. "Product SKU" -> "sku", "Quantity Delta" -> "quantitydelta").
   */
  public static normalizeHeader(header: string): string {
    return header
      .trim()
      .toLowerCase()
      .replace(/[\s_-]+/g, '');
  }

  /**
   * Sanitizes values against CSV Formula Injection (DDE injection).
   * If a value starts with '=', '+', '-', '@', '\t', or '\r', an apostrophe is prepended.
   */
  public static sanitizeFormula(val: unknown): string {
    if (val === null || val === undefined) return '';
    const str = String(val);
    if (/^[=+\-@\t\r]/.test(str)) {
      return `'${str}`;
    }
    return str;
  }

  /**
   * Escapes a value according to RFC 4180 rules.
   */
  public static escapeCsvCell(val: unknown): string {
    const safeStr = this.sanitizeFormula(val);
    if (
      safeStr.includes(',') ||
      safeStr.includes('"') ||
      safeStr.includes('\n') ||
      safeStr.includes('\r')
    ) {
      return `"${safeStr.replace(/"/g, '""')}"`;
    }
    return safeStr;
  }

  /**
   * Parses RFC 4180 CSV string safely, honoring quotes, escaped quotes, newlines within cells, and row bounds.
   */
  public static parse(csvContent: string): ParsedCsvResult {
    const cleanContent = this.stripBom(csvContent);
    const rawLines = this.tokenizeRows(cleanContent);

    if (rawLines.length === 0) {
      return {
        headers: [],
        normalizedHeaders: [],
        headerMap: {},
        rows: [],
        totalRows: 0,
      };
    }

    const rawHeaders = rawLines[0] || [];
    const normalizedHeaders: string[] = [];
    const headerMap: Record<string, string> = {};

    for (const h of rawHeaders) {
      const trimmed = h.trim();
      const norm = this.normalizeHeader(trimmed);
      normalizedHeaders.push(norm);
      if (norm && !headerMap[norm]) {
        headerMap[norm] = trimmed;
      }
    }

    const rows: Array<{ rowNumber: number; data: Record<string, string> }> = [];
    const dataLines = rawLines.slice(1);

    for (let i = 0; i < dataLines.length; i++) {
      const line = dataLines[i];
      if (!line) continue;

      // Skip completely empty lines
      const isAllEmpty = line.every((cell) => cell.trim() === '');
      if (isAllEmpty) {
        continue;
      }

      const rowNumber = i + 2; // 1-indexed, header is line 1
      const data: Record<string, string> = {};

      for (let colIdx = 0; colIdx < normalizedHeaders.length; colIdx++) {
        const normHeader = normalizedHeaders[colIdx];
        if (normHeader) {
          data[normHeader] = (line[colIdx] ?? '').trim();
        }
      }

      rows.push({
        rowNumber,
        data,
      });

      if (rows.length > MAX_IMPORT_ROWS) {
        throw new Error(
          `Import file exceeds maximum allowed rows limit of ${MAX_IMPORT_ROWS.toLocaleString()} rows.`,
        );
      }
    }

    return {
      headers: rawHeaders.map((h) => h.trim()),
      normalizedHeaders,
      headerMap,
      rows,
      totalRows: rows.length,
    };
  }

  /**
   * State-machine tokenizer that splits CSV into rows and cells according to RFC 4180.
   */
  private static tokenizeRows(text: string): string[][] {
    const rows: string[][] = [];
    let currentRow: string[] = [];
    let currentCell = '';
    let inQuotes = false;
    let i = 0;
    const len = text.length;

    while (i < len) {
      const char = text[i];

      if (inQuotes) {
        if (char === '"') {
          if (i + 1 < len && text[i + 1] === '"') {
            // Escaped quote: "" -> "
            currentCell += '"';
            i += 2;
            continue;
          } else {
            // End of quote
            inQuotes = false;
            i++;
            continue;
          }
        } else {
          currentCell += char;
          i++;
          continue;
        }
      } else {
        if (char === '"') {
          inQuotes = true;
          i++;
          continue;
        } else if (char === ',') {
          currentRow.push(currentCell);
          currentCell = '';
          i++;
          continue;
        } else if (char === '\r') {
          // Check for CRLF
          if (i + 1 < len && text[i + 1] === '\n') {
            i++;
          }
          currentRow.push(currentCell);
          rows.push(currentRow);
          currentRow = [];
          currentCell = '';
          i++;
          continue;
        } else if (char === '\n') {
          currentRow.push(currentCell);
          rows.push(currentRow);
          currentRow = [];
          currentCell = '';
          i++;
          continue;
        } else {
          currentCell += char;
          i++;
          continue;
        }
      }
    }

    // Append last cell / row if not empty or if in-flight
    if (currentCell !== '' || currentRow.length > 0) {
      currentRow.push(currentCell);
      rows.push(currentRow);
    }

    return rows;
  }
}

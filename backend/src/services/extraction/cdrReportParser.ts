import { CdrReportData } from './types';

const CDR_REPORT_PATTERN = /Cash Drawer Report/i;
const POST_DATE_PATTERN = /Post Date Range:\s*(.+)/i;
const PAYMENT_SITE_PATTERN = /Payment Site:\s*(\d+)/i;
const CASH_DRAWER_TOTALS_PATTERN = /Cash Drawer\s+(\d+)\s+Totals/gi;
const ORDER_ID_PATTERN = /\b(\d{7,}[A-Z][A-Z0-9]{1,4})\b/g;
const GRAND_TOTALS_MARKER = /GRAND TOTALS/i;
const TOTALS_LINE_PATTERN = /Totals:\s+/i;

// Require digit before decimal to reject OCR fragments like ",466.79"
const DOLLAR_AMOUNT_PATTERN = /\$?\s*(\d[\d,]*\.\d{2})/g;

export function isCdrReport(text: string): boolean {
  return CDR_REPORT_PATTERN.test(text);
}

export function parseCdrReport(text: string): CdrReportData {
  return {
    cash_drawers: extractCashDrawers(text),
    grand_total: extractGrandTotal(text),
    total_refund: extractTotalRefund(text),
    trans_count: extractTransCount(text),
    order_ids: extractOrderIds(text),
    payment_site: extractPaymentSite(text),
    post_date: extractPostDate(text),
  };
}

export function calculateCdrConfidence(fields: CdrReportData): number {
  let score = 0;
  const total = 4;
  if (fields.cash_drawers.length > 0) score++;
  if (fields.grand_total) score++;
  if (fields.trans_count !== null) score++;
  if (fields.order_ids.length > 0) score++;
  return score / total;
}

function extractCashDrawers(text: string): number[] {
  const drawers = new Set<number>();
  const matches = text.matchAll(CASH_DRAWER_TOTALS_PATTERN);
  for (const m of matches) {
    const num = parseInt(m[1] ?? '', 10);
    if (!isNaN(num)) drawers.add(num);
  }
  if (drawers.size > 0) return [...drawers].sort((a, b) => a - b);
  return extractDrawersFromTransactionLines(text);
}

function extractDrawersFromTransactionLines(text: string): number[] {
  const drawers = new Set<number>();
  const lines = text.split('\n');
  for (const line of lines) {
    if (!ORDER_ID_PATTERN.test(line)) continue;
    ORDER_ID_PATTERN.lastIndex = 0;
    const drawerMatch = line.match(/^\s*(\d{1,3})\s+[A-Z]/);
    if (drawerMatch) {
      drawers.add(parseInt(drawerMatch[1]!, 10));
    }
  }
  return [...drawers].sort((a, b) => a - b);
}

function extractOrderIds(text: string): string[] {
  const ids = new Set<string>();
  const matches = text.matchAll(ORDER_ID_PATTERN);
  for (const m of matches) {
    if (m[1]) ids.add(m[1]);
  }
  return [...ids];
}

function extractPaymentSite(text: string): string | null {
  return text.match(PAYMENT_SITE_PATTERN)?.[1]?.trim() ?? null;
}

function extractPostDate(text: string): string | null {
  return text.match(POST_DATE_PATTERN)?.[1]?.trim() ?? null;
}

function findGrandTotalsLine(text: string): string | null {
  const lines = text.split('\n');
  let inGrandTotals = false;
  let lastTotalsLine: string | null = null;

  for (const line of lines) {
    if (GRAND_TOTALS_MARKER.test(line)) {
      inGrandTotals = true;
      continue;
    }
    if (inGrandTotals && TOTALS_LINE_PATTERN.test(line)) {
      lastTotalsLine = line;
    }
  }
  return lastTotalsLine;
}

function parseDollarValue(str: string): number {
  return parseFloat(str.replace(/,/g, ''));
}

function extractGrandTotal(text: string): string | null {
  const line = findGrandTotalsLine(text);
  if (!line) return null;
  const amounts = extractDollarAmounts(line);
  if (amounts.length === 0) return null;
  // Grand total is the largest amount on the line
  // (covers both 2-col and 3-col OCR variations)
  return [...amounts].sort(
    (a, b) => parseDollarValue(b) - parseDollarValue(a)
  )[0] ?? null;
}

function extractTotalRefund(text: string): string | null {
  const line = findGrandTotalsLine(text);
  if (!line) return null;
  const amounts = extractDollarAmounts(line);
  // Only report refund when we have 3+ amounts (Refund, Payment, Total)
  if (amounts.length < 3) return null;
  return amounts[0] ?? null;
}

function extractTransCount(text: string): number | null {
  const line = findGrandTotalsLine(text);
  if (!line) return null;
  // Trans count is the trailing integer on the totals line
  const trailingNumber = line.match(/(\d+)\s*$/);
  if (!trailingNumber) return null;
  const count = parseInt(trailingNumber[1]!, 10);
  // Sanity check: trans count should be reasonable (not a dollar fragment)
  return count <= 999 ? count : null;
}

function extractDollarAmounts(line: string): string[] {
  const amounts: string[] = [];
  const matches = line.matchAll(DOLLAR_AMOUNT_PATTERN);
  for (const m of matches) {
    if (m[1]) amounts.push(m[1]);
  }
  return amounts;
}

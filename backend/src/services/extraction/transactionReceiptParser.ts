import { FinsalesData, ReceiptTransaction } from './types';

const RECEIPT_PATTERN = /Transaction\s+Receipt/i;
const CUSTOMER_ID_PATTERN = /Customer\s+ID[;:]\s*(\S+)/i;
const SALES_ORDER_PATTERN = /Sales\s+Order[;:]\s*(\S+)/i;
const CASHIER_PATTERN = /Cashier[;:]\s*(\S+)/i;
const PRINTED_ON_PATTERN = /Printed\s+on[;:]\s*([\d/]+)/i;
const PHONE_PATTERN = /(?:Home|Phone)[;:]\s*(\(?\d{3}\)?\s*[-.]?\s*\d{3}\s*[-.]?\s*\d{4})/gi;
const CITY_STATE_ZIP_PATTERN = /^([A-Z][A-Za-z\s]+,\s*[A-Z]{2}\s+\d{5}(?:-\d{4})?)$/;
const STORE_SUFFIX_PATTERN = /\s+[-–]\s*\d{2}$|\s+Store\s+\d+$/i;
const TXN_HEADER_PATTERN = /Date\s+Ty/i;
const TXN_END_PATTERN = /Cashier|Customer:|SIGNATURE/i;
const DATE_PATTERN = /\b(\d{1,2}\/\d{2}\/\d{4})\b/;
// Only strip [...] and {...} noise (NOT parens — "(refund)" is real content)
const BRACKET_NOISE = /[\[{][^\]}]*[\]}]/g;

const PAYMENT_KEYWORDS: [RegExp, string][] = [
  [/Podium/i, 'Podium'],
  [/Master\s*Card/i, 'Master Card'],
  [/VISA\s*CARDS?/i, 'VISA'],
  [/American\s*Express|Amex/i, 'American Express'],
  [/\bExpress\b/i, 'American Express'],
  [/Discover/i, 'Discover'],
  [/Check/i, 'Check'],
  [/\bCash\b/i, 'Cash'],
  [/Debit/i, 'Debit'],
];

export function isTransactionReceipt(rawText: string): boolean {
  return RECEIPT_PATTERN.test(rawText);
}

export function parseTransactionReceipt(
  rawText: string
): FinsalesData & { transactions: ReceiptTransaction[] } {
  const { name, address, cityStateZip } = extractCustomerBlock(rawText);

  return {
    fulfillment: 'RECEIPT',
    order_type: null,
    order_id: extractField(rawText, SALES_ORDER_PATTERN),
    customer_name: name,
    customer_id: extractField(rawText, CUSTOMER_ID_PATTERN),
    address,
    city_state_zip: cityStateZip,
    ship_to_name: null,
    ship_to_address: null,
    ship_to_city_state_zip: null,
    phone: extractPhones(rawText),
    delivery_date: extractField(rawText, PRINTED_ON_PATTERN),
    salesperson: extractField(rawText, CASHIER_PATTERN),
    truck_id: null,
    total_sale: null,
    stat: null,
    stop: null,
    zone: null,
    customer_code: null,
    finance_company: null,
    financed_amount: null,
    transactions: extractTransactions(rawText),
  };
}

export function calculateReceiptConfidence(
  fields: FinsalesData & { transactions?: ReceiptTransaction[] }
): number {
  const keyFields = [
    fields.order_id,
    fields.customer_name,
    fields.delivery_date,
  ];
  const populated = keyFields.filter((v) => v !== null).length;
  const hasTxns = (fields.transactions?.length ?? 0) > 0 ? 1 : 0;
  return (populated + hasTxns) / (keyFields.length + 1);
}

function extractField(text: string, pattern: RegExp): string | null {
  const match = text.match(pattern);
  return match?.[1]?.trim().toUpperCase() ?? null;
}

function extractCustomerBlock(text: string): {
  name: string | null;
  address: string | null;
  cityStateZip: string | null;
} {
  const lines = text.split('\n');
  const receiptIdx = lines.findIndex((l) => RECEIPT_PATTERN.test(l));
  if (receiptIdx < 0) return { name: null, address: null, cityStateZip: null };

  const nextLine = lines[receiptIdx + 1]?.trim() ?? '';
  const namePart = nextLine.split(/Printed\s+on/i)[0]?.trim() ?? null;
  const name = namePart?.toUpperCase() ?? null;

  const addressLine = lines[receiptIdx + 2]?.trim() ?? '';
  const addressPart = addressLine.split(/\s{3,}/)[0]?.trim() ?? '';
  const address =
    addressPart.replace(STORE_SUFFIX_PATTERN, '').trim().toUpperCase() || null;

  let cityStateZip: string | null = null;
  for (
    let i = receiptIdx + 3;
    i < Math.min(receiptIdx + 6, lines.length);
    i++
  ) {
    const line = lines[i]?.trim() ?? '';
    if (CITY_STATE_ZIP_PATTERN.test(line)) {
      cityStateZip = line.toUpperCase();
      break;
    }
  }

  return { name, address, cityStateZip };
}

function extractPhones(text: string): string | null {
  const matches = [...text.matchAll(PHONE_PATTERN)];
  const phones = matches.map((m) => m[1]?.trim()).filter(Boolean);
  const unique = [...new Set(phones)];
  return unique.length > 0 ? unique.join(', ') : null;
}

function getTransactionBlock(rawText: string): string[] | null {
  const lines = rawText.split('\n');
  const headerIdx = lines.findIndex((l) => TXN_HEADER_PATTERN.test(l));
  if (headerIdx < 0) return null;

  const endIdx = lines.findIndex(
    (l, i) => i > headerIdx && TXN_END_PATTERN.test(l)
  );
  const end = endIdx > headerIdx ? endIdx : lines.length;
  return lines.slice(headerIdx + 1, end);
}

function findPrevNonEmpty(lines: string[], fromIdx: number): string {
  for (let j = fromIdx - 1; j >= Math.max(0, fromIdx - 3); j--) {
    if (lines[j]!.trim()) return lines[j]!;
  }
  return '';
}

function extractTransactions(rawText: string): ReceiptTransaction[] {
  const blockLines = getTransactionBlock(rawText);
  if (!blockLines) return [];

  const transactions: ReceiptTransaction[] = [];

  for (let i = 0; i < blockLines.length; i++) {
    const dateMatch = blockLines[i]!.match(DATE_PATTERN);
    if (!dateMatch) continue;

    // Look back up to 3 lines for the type prefix (skip empty lines)
    const prevLine = findPrevNonEmpty(blockLines, i);
    const currLine = blockLines[i]!;
    const nextLine = i < blockLines.length - 1 ? blockLines[i + 1]! : '';

    // Base keyword from prev+current only (avoid adjacent txn bleed)
    // Modifiers (LOFT, refund) from all 3 lines
    const typeLines = [prevLine, currLine];
    const modifierLines = [prevLine, currLine, nextLine];

    transactions.push({
      date: dateMatch[1]!,
      payment_type: detectPaymentType(typeLines, modifierLines),
      amount: extractTransactionAmount(currLine),
    });
  }

  return transactions;
}

function cleanLines(lines: string[]): string {
  return lines.map((l) => l.replace(BRACKET_NOISE, ' ')).join(' ');
}

function detectPaymentType(
  typeLines: string[],
  modifierLines: string[]
): string | null {
  // Clean brackets per-line to avoid cross-line bracket spans eating content
  const cleanedType = cleanLines(typeLines);
  const cleanedMod = cleanLines(modifierLines);

  let base: string | null = null;
  for (const [pattern, name] of PAYMENT_KEYWORDS) {
    if (pattern.test(cleanedType)) {
      base = name;
      break;
    }
  }
  if (!base) return null;

  if (/LOFT/i.test(cleanedMod)) {
    base += ' - LOFT';
  }

  if (/refund/i.test(cleanedMod)) {
    base += ' (refund)';
  }

  return base;
}

function extractTransactionAmount(line: string): string | null {
  // Try negative first: handles -, ~, « as negative signs (OCR variants)
  const negative = line.match(/[-~«]\s*\$\s*([\d,]+\.\d{2})/);
  if (negative) return `-$${negative[1]}`;

  // Positive amount
  const positive = line.match(/\$\s*([\d,]+\.\d{2})/);
  if (positive) return `$${positive[1]}`;

  return null;
}

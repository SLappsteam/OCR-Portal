import { FinsalesData } from './types';

const RECEIPT_PATTERN = /Transaction\s+Receipt/i;
const CUSTOMER_ID_PATTERN = /Customer\s+ID[;:]\s*(\S+)/i;
const SALES_ORDER_PATTERN = /Sales\s+Order[;:]\s*(\S+)/i;
const CASHIER_PATTERN = /Cashier[;:]\s*(\S+)/i;
const PRINTED_ON_PATTERN = /Printed\s+on[;:]\s*([\d/]+)/i;
const EMAIL_PATTERN = /Email[;:]\s*(\S+@\S+)/i;
const PHONE_PATTERN = /(?:Home|Phone)[;:]\s*(\(?\d{3}\)?\s*[-.]?\s*\d{3}\s*[-.]?\s*\d{4})/gi;
const CITY_STATE_ZIP_PATTERN = /^([A-Z][A-Za-z\s]+,\s*[A-Z]{2}\s+\d{5}(?:-\d{4})?)$/;
const AMOUNT_PATTERN = /(-?)\$\s*([\d,.]+)/g;
const STORE_SUFFIX_PATTERN = /\s+[-–]\s*\d{2}$|\s+Store\s+\d+$/i;

export function isTransactionReceipt(rawText: string): boolean {
  return RECEIPT_PATTERN.test(rawText);
}

export function parseTransactionReceipt(rawText: string): FinsalesData {
  const { name, address, cityStateZip } = extractCustomerBlock(rawText);
  const amounts = extractAmounts(rawText);
  const totalAmount = calculateTotal(amounts);

  return {
    fulfillment: 'RECEIPT',
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
    total_sale: totalAmount,
    stat: null,
    stop: null,
    zone: null,
    customer_code: null,
    finance_company: null,
    financed_amount: null,
  };
}

export function calculateReceiptConfidence(fields: FinsalesData): number {
  const keyFields = [
    fields.customer_name,
    fields.customer_id,
    fields.order_id,
    fields.total_sale,
  ];
  const populated = keyFields.filter((v) => v !== null).length;
  return populated / keyFields.length;
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
  const address = addressPart.replace(STORE_SUFFIX_PATTERN, '').trim().toUpperCase() || null;

  let cityStateZip: string | null = null;
  for (let i = receiptIdx + 3; i < Math.min(receiptIdx + 6, lines.length); i++) {
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

function extractAmounts(text: string): number[] {
  const matches = [...text.matchAll(AMOUNT_PATTERN)];
  return matches
    .map((m) => {
      const sign = m[1] === '-' ? -1 : 1;
      const raw = m[2]?.replace(/,/g, '') ?? '';
      return sign * parseFloat(raw);
    })
    .filter((n) => !isNaN(n));
}

function calculateTotal(amounts: number[]): string | null {
  if (amounts.length === 0) return null;
  const total = amounts.reduce((sum, n) => sum + n, 0);
  return total.toFixed(2);
}

import { FinsalesData } from './types';
import { uppercaseFields } from './headerParser';

const TICKET_PATTERN = /(DELIVERY|RETURN)\s+TIC\w*ET/i;
const ORDER_ID_PATTERN = /(?:Order|Return)\s+ID:\s*(\S+)/i;
const CUSTOMER_ID_PATTERN = /Customer\s+ID:\s*(\S+)/i;
const DELIVERY_DATE_PATTERN = /Delivery\s+Date:\s*([\d/]+)/i;
const SALESPERSON_PATTERN = /Salesperson:\s*(\S+)/i;
const TRUCK_ID_PATTERN = /Truck\s+ID:\s*(.+)/i;
const GROSS_SALES_PATTERN = /Gross\s*Sales?:?\s*\$?\s*([\d,.]+)/i;
const MOBILE_PATTERN = /Mobile:\s*(\(?\d{3}\)?\s*[-.]?\s*\d{3}\s*[-.]?\s*\d{4})/g;
const CITY_STATE_ZIP_PATTERN = /^([A-Z][A-Za-z\s]+,\s*[A-Z]{2}\s+\d{5}(?:-\d{4})?)$/;

export function isTicketPage(rawText: string): boolean {
  return TICKET_PATTERN.test(rawText);
}

export function parseTicketText(rawText: string): FinsalesData {
  return uppercaseFields({
    ticket_type: extractTicketType(rawText),
    order_type: null,
    order_id: extractOrderId(rawText),
    customer_name: extractCustomerName(rawText),
    customer_id: extractField(rawText, CUSTOMER_ID_PATTERN),
    address: extractShipToAddress(rawText),
    city_state_zip: extractShipToCityStateZip(rawText),
    phone: extractPhone(rawText),
    delivery_date: extractField(rawText, DELIVERY_DATE_PATTERN),
    salesperson: extractField(rawText, SALESPERSON_PATTERN),
    truck_id: extractTruckId(rawText),
    total_sale: extractField(rawText, GROSS_SALES_PATTERN),
    stat: null,
    zone: null,
    fulfillment_type: null,
    customer_code: null,
    finance_company: null,
    financed_amount: null,
  });
}

export function calculateTicketConfidence(fields: FinsalesData): number {
  const values = Object.values(fields);
  const populated = values.filter((v) => v !== null).length;
  return populated / values.length;
}

function extractTicketType(text: string): string | null {
  const match = text.match(TICKET_PATTERN);
  return match?.[1]?.toUpperCase() ?? null;
}

function extractOrderId(text: string): string | null {
  const match = text.match(ORDER_ID_PATTERN);
  return match?.[1]?.trim() ?? null;
}

function extractField(text: string, pattern: RegExp): string | null {
  const match = text.match(pattern);
  return match?.[1]?.trim() ?? null;
}

function extractTruckId(text: string): string | null {
  const match = text.match(TRUCK_ID_PATTERN);
  const value = match?.[1]?.trim() ?? null;
  if (!value) return null;
  // Stop at next known field if captured too much
  return value.split(/\n/)[0]?.trim() ?? value;
}

function parseAddressBlock(text: string): { billTo: string[]; shipTo: string[] } {
  const lines = text.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? '';
    if (!/Bill\s+To:/i.test(line)) continue;

    const isTwoColumn = /Ship\s+To:/i.test(line);
    if (isTwoColumn) {
      const billTo: string[] = [];
      const shipTo: string[] = [];
      for (let j = i + 1; j < Math.min(i + 5, lines.length); j++) {
        const raw = lines[j]?.trim() ?? '';
        if (!raw || /Mobile:/i.test(raw)) break;
        const { left, right } = splitColumns(raw);
        if (left) billTo.push(left);
        if (right) shipTo.push(right);
      }
      return { billTo, shipTo: shipTo.length > 0 ? shipTo : billTo };
    }

    // Single-column: Bill To only
    const block: string[] = [];
    for (let j = i + 1; j < Math.min(i + 5, lines.length); j++) {
      const raw = lines[j]?.trim();
      if (raw) block.push(raw);
    }
    return { billTo: block, shipTo: block };
  }

  return { billTo: [], shipTo: [] };
}

function splitColumns(line: string): { left: string; right: string } {
  // Exact duplication (Bill To = Ship To): "LISA CHEN LISA CHEN" → "LISA CHEN"
  const dupMatch = line.match(/^(.{3,}?)\s+\1\s*$/);
  if (dupMatch) {
    const val = dupMatch[1]!.trim();
    return { left: val, right: val };
  }
  // Different values: split at nearest word boundary to midpoint
  const mid = Math.floor(line.length / 2);
  const after = line.indexOf(' ', mid);
  const before = line.lastIndexOf(' ', mid);
  const splitAt = after >= 0 && (before < 0 || after - mid <= mid - before)
    ? after : before;
  if (splitAt > 0) {
    return { left: line.substring(0, splitAt).trim(), right: line.substring(splitAt).trim() };
  }
  return { left: line.trim(), right: line.trim() };
}

function extractCustomerName(text: string): string | null {
  return parseAddressBlock(text).billTo[0] ?? null;
}

function extractShipToAddress(text: string): string | null {
  return parseAddressBlock(text).shipTo[1] ?? null;
}

function extractShipToCityStateZip(text: string): string | null {
  for (const line of parseAddressBlock(text).shipTo.slice(2)) {
    if (CITY_STATE_ZIP_PATTERN.test(line)) return line;
  }
  return null;
}

function extractPhone(text: string): string | null {
  const matches = [...text.matchAll(MOBILE_PATTERN)];
  if (matches.length === 0) return null;
  // Prefer second match (Ship To) if available and different
  if (matches.length >= 2 && matches[1]![1] !== matches[0]![1]) {
    return matches[1]![1]!.trim();
  }
  return matches[0]![1]!.trim();
}

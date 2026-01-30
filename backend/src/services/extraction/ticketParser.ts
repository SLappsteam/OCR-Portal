import { FinsalesData } from './types';
import { uppercaseFields } from './headerParser';

const TICKET_PATTERN = /\*\s*(DELIVERY|RETURN)\s+TICKET\s*\*/i;
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

function extractCustomerName(text: string): string | null {
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (/Bill\s+To:/i.test(lines[i] ?? '')) {
      const nameLine = lines[i + 1]?.trim();
      if (nameLine && /^[A-Z]/.test(nameLine)) {
        return nameLine.split(/\s{3,}/)[0]?.trim() ?? nameLine;
      }
    }
  }
  return null;
}

function extractShipToAddress(text: string): string | null {
  const block = getShipToBlock(text);
  return block[1] ?? null;
}

function extractShipToCityStateZip(text: string): string | null {
  const block = getShipToBlock(text);
  for (const line of block.slice(2)) {
    if (CITY_STATE_ZIP_PATTERN.test(line)) {
      return line;
    }
  }
  return null;
}

function getShipToBlock(text: string): string[] {
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (!/Ship\s+To:/i.test(lines[i] ?? '')) continue;
    const block: string[] = [];
    for (let j = i + 1; j < Math.min(i + 5, lines.length); j++) {
      const line = lines[j]?.trim();
      if (line) block.push(line);
    }
    return block;
  }
  return [];
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

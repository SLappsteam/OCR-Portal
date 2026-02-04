import { FinsalesData } from './types';
import { uppercaseFields } from './headerParser';

// Final T optional: OCR may garble "TICKET" to "TICKE" when handwriting overlaps
const TICKET_PATTERN = /(D\s*E\s*L\s*I\s*V\s*E\s*R\s*Y|R\s*E\s*T\s*U\s*R\s*N)\s+TIC\w*ET?/i;
const ORDER_ID_PATTERN = /(?:Order|Return)\s+(?:ID|1D|0)[;:]\s*(.+?)(?:\s*\(|$)/im;
const CUSTOMER_ID_PATTERN = /Customer\s+ID[;:]\s*(\S+)/i;
const DELIVERY_DATE_PATTERN = /Delivery\s+Date:\s*([\d/]+)/i;
const SALESPERSON_PATTERN = /Salesperson:\s*([A-Za-z0-9]+)/i;
const TRUCK_ID_PATTERN = /Truck\s+ID:\s*(.+)/i;
const SUBTOTAL_PATTERN = /Subtotal:?\s*\$?\s*([\d,.]+)/i;
const SHIPPING_ZONE_PATTERN = /Shipping\s+Zone:\s*(\S+)/i;
const STOP_PATTERN = /Stop:\s*(\d+)/i;
const MOBILE_PATTERN = /Mobile:\s*\+?1?\s*(\(?\d{3}\)?\s*[-.]?\s*\d{3}\s*[-.]?\s*\d{4})/g;
const SECONDARY_PHONE_PATTERN = /Secondary\s+Phone:\s*\+?1?\s*(\(?\d{3}\)?\s*[-.]?\s*\d{3}\s*[-.]?\s*\d{4})/gi;
const CITY_STATE_ZIP_PATTERN = /^([A-Z][A-Za-z\s]+,\s*[A-Z]{2}\s+\d{5}(?:-\d{4})?)$/;

export function isTicketPage(rawText: string): boolean {
  return TICKET_PATTERN.test(rawText);
}

export function parseTicketText(rawText: string): FinsalesData {
  const { billTo, shipTo } = parseAddressBlock(rawText);
  return uppercaseFields({
    fulfillment: extractTicketType(rawText),
    order_type: null,
    order_id: extractOrderId(rawText),
    customer_name: billTo[0] ?? null,
    customer_id: extractField(rawText, CUSTOMER_ID_PATTERN),
    address: billTo[1] ?? null,
    city_state_zip: extractCityStateZip(billTo),
    ship_to_name: shipTo[0] ?? null,
    ship_to_address: shipTo[1] ?? null,
    ship_to_city_state_zip: extractCityStateZip(shipTo),
    phone: extractPhone(rawText),
    delivery_date: extractField(rawText, DELIVERY_DATE_PATTERN),
    salesperson: extractField(rawText, SALESPERSON_PATTERN),
    truck_id: extractTruckId(rawText),
    total_sale: extractField(rawText, SUBTOTAL_PATTERN),
    stat: null,
    stop: extractField(rawText, STOP_PATTERN),
    zone: extractField(rawText, SHIPPING_ZONE_PATTERN),
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
  return match?.[1]?.replace(/\s+/g, '').toUpperCase() ?? null;
}

function extractOrderId(text: string): string | null {
  const match = text.match(ORDER_ID_PATTERN);
  if (!match?.[1]) return null;
  return match[1].replace(/\s+/g, '').trim() || null;
}

function extractField(text: string, pattern: RegExp): string | null {
  const match = text.match(pattern);
  return match?.[1]?.trim() ?? null;
}

function extractTruckId(text: string): string | null {
  const match = text.match(TRUCK_ID_PATTERN);
  const value = match?.[1]?.trim() ?? null;
  if (!value) return null;
  const firstLine = value.split(/\n/)[0]?.trim() ?? value;
  return firstLine.replace(/[^A-Za-z0-9]+$/, '') || null;
}

function parseAddressBlock(text: string): { billTo: string[]; shipTo: string[] } {
  const lines = text.split('\n');
  const headerIdx = findAddressHeaderIndex(lines);
  if (headerIdx < 0) return { billTo: [], shipTo: [] };

  const headerLine = lines[headerIdx] ?? '';
  const hasBothColumns = /Ship\s*To/i.test(headerLine);
  if (hasBothColumns) {
    return extractColumnsFromIndex(lines, headerIdx + 1);
  }
  return extractSingleColumn(lines, headerIdx + 1);
}

function findAddressHeaderIndex(lines: string[]): number {
  // Primary: find Bill To label (tolerate OCR misreads like "Bilt", "Bil")
  for (let i = 0; i < lines.length; i++) {
    if (/B[il1][il1][ilt1]?\s*To[;:]/i.test(lines[i] ?? '')) return i;
  }
  // Fallback: address block follows Marker ID line
  for (let i = 0; i < lines.length; i++) {
    if (/Marker\s+\w+:/i.test(lines[i] ?? '')) return i;
  }
  return -1;
}

function extractColumnsFromIndex(
  lines: string[],
  startIdx: number,
): { billTo: string[]; shipTo: string[] } {
  const billTo: string[] = [];
  const shipTo: string[] = [];
  for (let j = startIdx; j < Math.min(startIdx + 7, lines.length); j++) {
    const raw = lines[j]?.trim().replace(/^[|]+\s*/, '').replace(/\s*[|]+$/, '') ?? '';
    if (/Mobile:/i.test(raw) || /Secondary\s+Phone:/i.test(raw)) break;
    if (!raw) continue;
    const { left, right } = splitColumns(raw);
    if (left) billTo.push(left);
    if (right) shipTo.push(right);
  }
  return { billTo, shipTo: shipTo.length > 0 ? shipTo : billTo };
}

function extractSingleColumn(
  lines: string[],
  startIdx: number,
): { billTo: string[]; shipTo: string[] } {
  const entries: string[] = [];
  for (let j = startIdx; j < Math.min(startIdx + 7, lines.length); j++) {
    const raw = lines[j]?.trim().replace(/^[|]+\s*/, '').replace(/\s*[|]+$/, '') ?? '';
    if (/Mobile:/i.test(raw) || /Secondary\s+Phone:/i.test(raw)) break;
    if (!raw) continue;
    const leftPart = raw.split(/\s{3,}/)[0]?.trim().replace(/[,]+$/, '') ?? '';
    if (leftPart.length >= 4) entries.push(leftPart);
  }
  return { billTo: entries, shipTo: entries };
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

function extractCityStateZip(lines: string[]): string | null {
  for (const line of lines.slice(2)) {
    if (CITY_STATE_ZIP_PATTERN.test(line)) return line;
  }
  return null;
}

function extractPhone(text: string): string | null {
  const mobileMatches = [...text.matchAll(MOBILE_PATTERN)];
  const secondaryMatches = [...text.matchAll(SECONDARY_PHONE_PATTERN)];

  const mobile = mobileMatches[0]?.[1]?.trim() ?? null;
  const secondary = dedupeSecondary(secondaryMatches);

  if (mobile && secondary && mobile !== secondary) {
    return `${mobile}, ${secondary}`;
  }
  return mobile ?? secondary;
}

function dedupeSecondary(matches: RegExpExecArray[]): string | null {
  if (matches.length === 0) return null;
  const unique = new Set(matches.map((m) => m[1]!.trim()));
  return [...unique][0] ?? null;
}

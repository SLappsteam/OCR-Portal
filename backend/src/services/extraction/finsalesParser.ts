import { FinsalesData } from './types';

export function parseFinsalesText(rawText: string): FinsalesData {
  return {
    ticket_type: null,
    order_id: extractOrderId(rawText),
    customer_name: extractCustomerName(rawText),
    customer_id: null,
    address: extractAddress(rawText),
    city_state_zip: extractCityStateZip(rawText),
    phone: extractPhone(rawText),
    delivery_date: extractDate(rawText),
    salesperson: extractSalesperson(rawText),
    truck_id: null,
    total_sale: extractTotal(rawText),
  };
}

function extractOrderId(text: string): string | null {
  // Primary: "NUMBER : 0302569NP45" on header line
  const numberMatch = text.match(/NUMBER\s*:\s*(\d\S+)/i);
  if (numberMatch?.[1]) return numberMatch[1].trim();

  // Fallback: "Order #: 12345" but NOT "ORDER TYPE:"
  const orderMatch = text.match(/Order\s*#\s*:?\s*(\d\S+)/i);
  return orderMatch?.[1]?.trim() ?? null;
}

const STREET_SUFFIX =
  '(?:Street|Court|Avenue|Boulevard|Drive|Road|Lane|Place|Circle|Highway|Parkway|Trail' +
  '|St\\.?|Ave\\.?|Blvd\\.?|Dr\\.?|Rd\\.?|Way|Ln\\.?|Ct\\.?|Pl\\.?|Cir\\.?|Hwy\\.?|Pkwy\\.?)';

function extractCustomerName(text: string): string | null {
  // Name appears between store address suffix and "ORDER TYPE:" on same line
  const primary = new RegExp(
    `${STREET_SUFFIX}\\s+([A-Z][A-Za-z /.'()-]+?)\\s+(?:NA\\s+)?ORDER\\s+TYPE`, 'i'
  );
  const match = text.match(primary);
  if (match?.[1]) return match[1].trim();

  // Fallback: line containing "ORDER TYPE:" — name is between address and ORDER TYPE
  const lines = text.split('\n');
  for (const line of lines) {
    if (!/ORDER\s+TYPE/i.test(line)) continue;
    const before = line.split(/ORDER\s+TYPE/i)[0] ?? '';
    // Extract last name-like segment (2+ uppercase words)
    const nameMatch = before.match(
      /([A-Z][A-Za-z/]+(?:\s+[A-Z][A-Za-z/]+)+)\s*$/
    );
    if (nameMatch?.[1]) return nameMatch[1].trim();
  }
  return null;
}

function extractAddress(text: string): string | null {
  // Line after ORDER TYPE: "{store city/zip} {customer address} Pickup"
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (!/ORDER\s+TYPE/i.test(lines[i] ?? '')) continue;
    const nextLine = lines[i + 1];
    if (!nextLine) continue;

    // Strip store city/state/zip from left column (anchored to comma + state)
    const afterZip = nextLine.replace(
      /^.*,\s*[A-Z0-9|]{2}\s+\d{5}(?:-\d{4})?\s+/, ''
    );
    if (!afterZip || afterZip === nextLine) continue;

    return afterZip.replace(/\s*(Pickup|Delivery)\s*$/i, '').trim() || null;
  }
  return null;
}

function extractCityStateZip(text: string): string | null {
  // CITY, ST ZIP before DATE: (allow OCR errors like 1A or |A for IA)
  const match = text.match(
    /([A-Z][A-Za-z\s]+,\s*[A-Z0-9|]{2}\s+\d{5}(?:-\d{4})?)\s+DATE:/i
  );
  return match?.[1]?.trim() ?? null;
}

function extractPhone(text: string): string | null {
  // Customer mobile phone is labeled M/P: on detail pages
  const mobile = text.match(
    /M\/P:\s*(\(?\d{3}\)?\s*[-.]?\s*\d{3}\s*[-.]?\s*\d{4})/
  );
  if (mobile?.[1]) return mobile[1].trim();

  // Secondary phone labeled S/P:
  const secondary = text.match(
    /S\/P:\s*(\(?\d{3}\)?\s*[-.]?\s*\d{3}\s*[-.]?\s*\d{4})/
  );
  return secondary?.[1]?.trim() ?? null;
}

function extractDate(text: string): string | null {
  const match = text.match(/DATE:\s*([\d/]+)/i);
  return match?.[1]?.trim() ?? null;
}

function extractSalesperson(text: string): string | null {
  const match = text.match(/SALESPERSON:\s*([A-Z][A-Z ]+)/i);
  return match?.[1]?.trim() ?? null;
}

function extractTotal(text: string): string | null {
  const match = text.match(/Gross\s*Sales?:?\s*\$?\s*([\d,.]+)/i);
  return match?.[1]?.trim() ?? null;
}

export function calculateConfidence(fields: FinsalesData): number {
  const values = Object.values(fields);
  const populated = values.filter((v) => v !== null).length;
  return populated / values.length;
}

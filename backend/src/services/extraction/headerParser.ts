import { FinsalesData } from './types';

export const STREET_SUFFIX =
  '(?:Street|Court|Avenue|Boulevard|Drive|Road|Lane|Place|Circle|Highway|Parkway|Trail' +
  '|St\\.?|Ave\\.?|B[il1]vd\\.?|Dr\\.?|Rd\\.?|Way|Ln\\.?|Ct\\.?|Pl\\.?|Cir\\.?|Hwy\\.?|Pkwy\\.?|Trl\\.?)';

// Directional suffixes that can follow street type (e.g., "Ave. NE", "St. SW")
const DIRECTIONAL_SUFFIX = '(?:\\s+(?:N|S|E|W|NE|NW|SE|SW)\\.?)?';

const HEADER_LINE_PATTERN = /TYPE\s*:.*STAT\s*[.:]/i;
const CREDIT_LINE_PATTERN = /CREDIT\s*:\s*\d/i;

export function extractHeader(rawText: string): Partial<FinsalesData> {
  const { address, fulfillmentType } = extractAddressAndFulfillment(rawText);
  const billToAddress = address ?? extractBillToAddress(rawText);
  const cityStateZip = extractCityStateZip(rawText) ?? extractBillToCityStateZip(rawText);
  const isCredit = CREDIT_LINE_PATTERN.test(rawText);

  return {
    fulfillment: fulfillmentType ?? (isCredit ? 'CREDIT' : null),
    order_id: extractOrderId(rawText),
    customer_name: extractCustomerName(rawText),
    address: billToAddress,
    city_state_zip: cityStateZip,
    phone: extractPhone(rawText),
    delivery_date: extractDate(rawText),
    salesperson: extractSalesperson(rawText),
    stat: extractStat(rawText),
    zone: extractZone(rawText),
    customer_code: extractCustomerCode(rawText),
  };
}

function extractOrderId(text: string): string | null {
  // Primary pattern: NUMBER/RETURN/CREDIT : <order_id>
  // OCR-tolerant: "NUMBER" often misread as "MBER", "BER", "UMBER", etc.
  const numberMatch = text.match(/(?:N?U?M?BER|NUMBER|RETURN|CREDIT)\s*:\s*(\d\S+)/i);
  if (numberMatch?.[1]) return numberMatch[1].trim();

  const orderMatch = text.match(/Order\s*#\s*:?\s*(\d\S+)/i);
  if (orderMatch?.[1]) return orderMatch[1].trim();

  // Fallback: look for order ID pattern in upper portion of document
  // Order IDs typically: digits followed by letters+digits (e.g., 0302578ND76)
  const lines = text.split('\n').slice(0, 10);
  for (const line of lines) {
    const fallback = line.match(/:\s*(\d{5,}\w{2,})/);
    if (fallback?.[1]) return fallback[1].trim();
  }

  return null;
}

function extractCustomerName(text: string): string | null {
  // Primary: name between store address suffix (with optional directional) and "ORDER TYPE:"
  // Examples: "Ave. NE Steve Hazuka ORDER TYPE:", "St. Steve Jones ORDER TYPE:"
  const primary = new RegExp(
    `\\b${STREET_SUFFIX}${DIRECTIONAL_SUFFIX}\\s+([A-Z][A-Za-z /.'()-]+?)\\s+(?:NA\\s+)?ORDER\\s+TYPE`, 'i'
  );
  const match = text.match(primary);
  if (match?.[1]) return match[1].trim();

  // Credit pages: name between street suffix and "CREDIT:"
  const creditPrimary = new RegExp(
    `\\b${STREET_SUFFIX}${DIRECTIONAL_SUFFIX}\\s+([A-Z][A-Za-z /.'()-]+?)\\s+CREDIT\\s*:`, 'i'
  );
  const creditMatch = text.match(creditPrimary);
  if (creditMatch?.[1]) return creditMatch[1].trim();

  // Fallback: find header line via TYPE:...STAT: or CREDIT:, extract name
  const lines = text.split('\n');
  let idx = lines.findIndex((l) => HEADER_LINE_PATTERN.test(l));
  if (idx < 0) {
    idx = lines.findIndex((l) => CREDIT_LINE_PATTERN.test(l));
  }
  if (idx >= 0) {
    const before = (lines[idx] ?? '').split(/(?:TYPE|CREDIT)\s*:/i)[0] ?? '';
    // Strip street suffix and optional directional (e.g., "Ave. NE")
    const afterStreet = before.replace(
      new RegExp(`^.*\\b${STREET_SUFFIX}${DIRECTIONAL_SUFFIX}\\s+`, 'i'), ''
    );
    const nameMatch = afterStreet.match(/^([A-Z][A-Za-z]+(?:\s+[A-Z][A-Za-z]+)*)/);
    if (nameMatch?.[1]) return nameMatch[1].trim();
  }

  // Bill To fallback: name on line after "Bill To:"
  return extractBillToName(text);
}

function extractBillToName(text: string): string | null {
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

export function extractBillToAddress(text: string): string | null {
  const block = getBillToBlock(text);
  return block[1] ?? null;
}

export function extractBillToCityStateZip(text: string): string | null {
  const block = getBillToBlock(text);
  const cityStateZipPattern = /^([A-Z][A-Za-z\s]+,\s*[A-Z]{2}\s+\d{5}(?:-\d{4})?)$/;
  for (const line of block.slice(2)) {
    if (cityStateZipPattern.test(line)) {
      return line;
    }
  }
  return null;
}

function getBillToBlock(text: string): string[] {
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (!/Bill\s+To:/i.test(lines[i] ?? '')) continue;
    const block: string[] = [];
    for (let j = i + 1; j < Math.min(i + 5, lines.length); j++) {
      const line = lines[j]?.trim();
      if (line) block.push(line);
    }
    return block;
  }
  return [];
}

function extractAddressAndFulfillment(
  text: string
): { address: string | null; fulfillmentType: string | null } {
  const lines = text.split('\n');
  const idx = lines.findIndex((l) => HEADER_LINE_PATTERN.test(l));
  if (idx < 0) return { address: null, fulfillmentType: null };

  const nextLine = lines[idx + 1];
  if (!nextLine) return { address: null, fulfillmentType: null };

  const afterZip = nextLine.replace(
    /^.*,\s*[A-Z0-9|]{2}\s+\d{5}(?:-\d{4})?\s+/, ''
  );
  if (!afterZip || afterZip === nextLine) {
    return { address: null, fulfillmentType: null };
  }

  const typeMatch = afterZip.match(/\s+(Pickup|Delivery)\s*[|]?\s*$/i);
  const fulfillmentType = typeMatch?.[1]?.trim() ?? null;
  const rawAddress = afterZip.replace(/\s*(Pickup|Delivery)\s*[|]?\s*$/i, '').trim();
  const address = rawAddress.replace(/[\s\\|«»<>]+$/, '').trim() || null;
  return { address, fulfillmentType };
}

function extractCityStateZip(text: string): string | null {
  const match = text.match(
    /([A-Z][A-Za-z\s]+,\s*[A-Z0-9|]{2}\s+\d{5}(?:-\d{4})?)\s+DATE:/i
  );
  return match?.[1]?.trim() ?? null;
}

function extractPhone(text: string): string | null {
  const phonePattern = /(\(?\d{3}\)?\s*[-.]?\s*\d{3}\s*[-.]?\s*\d{4})/;

  const mobile = text.match(new RegExp(`M\\/P[;:]\\s*${phonePattern.source}`));
  const sp = text.match(new RegExp(`S\\/P[;:]\\s*${phonePattern.source}`));
  const secondary = text.match(new RegExp(`Secondary\\s+Phone:\\s*${phonePattern.source}`, 'i'));

  const primary = mobile?.[1]?.trim() ?? null;
  const fallback = sp?.[1]?.trim() ?? secondary?.[1]?.trim() ?? null;

  if (primary && fallback && primary !== fallback) {
    return `${primary}, ${fallback}`;
  }
  return primary ?? fallback;
}

function extractDate(text: string): string | null {
  const match = text.match(/DATE:\s*([\d/]+)/i);
  return match?.[1]?.trim() ?? null;
}

function extractSalesperson(text: string): string | null {
  const match = text.match(/SALESPERSON:\s*([A-Z][A-Z ]+)/i);
  return match?.[1]?.trim() ?? null;
}

function extractStat(text: string): string | null {
  const match = text.match(/STAT[.:]\s*(\S+)/i);
  if (!match?.[1]) return null;
  // STAT codes are letters — map common OCR digit misreads to letters
  return match[1].replace(/0/g, 'O').replace(/1/g, 'I');
}

function extractZone(text: string): string | null {
  const match = text.match(/ZONE\s*:?\s*(\d+)/i);
  return match?.[1]?.trim() ?? null;
}

function extractCustomerCode(text: string): string | null {
  const match = text.match(/C\.\s*Code:\s*(\S+)/i);
  return match?.[1]?.trim() ?? null;
}

export function uppercaseFields(data: FinsalesData): FinsalesData {
  const result = { ...data };
  for (const key of Object.keys(result) as (keyof FinsalesData)[]) {
    const val = result[key];
    if (typeof val === 'string') {
      (result[key] as string) = val.toUpperCase();
    }
  }
  return result;
}

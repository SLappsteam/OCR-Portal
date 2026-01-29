import { logger } from '../../utils/logger';

export interface SummaryOrder {
  order_id: string;
  customer_name: string;
}

// Separator chars OCR produces between order ID and customer name
const SEP = `[*~<>\\-+v«».,\\u201C\\u201D"']`;

// Primary: order ID → separator → customer name → SAL/RET/EXC/Sale/Closed
const ORDER_LINE_PATTERN = new RegExp(
  `^(\\d{5,}[A-Z0-9]+)\\s+${SEP}?\\s*([A-Z][A-Z /.'-]{2,}?)\\s+(?:SAL|RET|EXC|Sale|Closed)\\b`,
  'i'
);

// Fallback: order ID → optional separator → capitalized name (3+ chars)
const ORDER_LINE_FALLBACK = new RegExp(
  `^(\\d{5,}[A-Z0-9]+)\\s+${SEP}?\\s*([A-Z][A-Z /.'()\\-]{3,})`,
  'i'
);

export function parseSummaryText(rawText: string): SummaryOrder[] {
  const lines = rawText.split('\n');
  const orders: SummaryOrder[] = [];
  const seen = new Set<string>();

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const match = trimmed.match(ORDER_LINE_PATTERN)
      ?? trimmed.match(ORDER_LINE_FALLBACK);

    if (!match) continue;

    const orderId = match[1]?.trim() ?? '';
    const customerName = cleanCustomerName(match[2] ?? '');

    if (!customerName || customerName.length < 3) continue;
    if (seen.has(orderId)) continue;

    seen.add(orderId);
    orders.push({ order_id: orderId, customer_name: customerName });
  }

  logger.info(`Summary parser: found ${orders.length} orders`);
  return orders;
}

function cleanCustomerName(raw: string): string {
  return raw
    .replace(/\s+/g, ' ')
    .replace(/[^A-Za-z /.'()-]/g, '')
    .replace(/^[A-Z]\s+/, '') // strip single-letter OCR separator artifact
    .trim();
}

export function isSummaryPage(rawText: string): boolean {
  const headerPattern = /Order\s+Customer\s+Type\s+Status/i;
  return headerPattern.test(rawText);
}

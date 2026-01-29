import { FinsalesData } from './types';

const FIELD_PATTERNS: Record<keyof FinsalesData, RegExp> = {
  order_id: /Order\s*#?\s*:?\s*(\S+)/i,
  customer_name: /Customer\s*:?\s*(.+)/i,
  customer_id: /Cust\s*#?\s*:?\s*(\S+)/i,
  address: /Address\s*:?\s*(.+)/i,
  city_state_zip: /(?:City|CSZ)\s*:?\s*(.+)/i,
  phone: /(?:Phone|Ph)\s*:?\s*([\d\s().-]+)/i,
  delivery_date: /(?:Del(?:ivery)?\s*Date|Delivery)\s*:?\s*(.+)/i,
  salesperson: /(?:Salesperson|Sales)\s*:?\s*(.+)/i,
  truck_id: /Truck\s*:?\s*(\S+)/i,
  total_sale: /(?:Total\s*Sale|Total)\s*:?\s*\$?\s*([\d,.]+)/i,
};

function extractField(text: string, pattern: RegExp): string | null {
  const match = text.match(pattern);
  if (!match?.[1]) return null;
  const value = match[1].trim();
  return value.length > 0 ? value : null;
}

export function parseFinsalesText(rawText: string): FinsalesData {
  const fields: Partial<FinsalesData> = {};

  for (const [key, pattern] of Object.entries(FIELD_PATTERNS)) {
    fields[key as keyof FinsalesData] = extractField(rawText, pattern);
  }

  return {
    order_id: fields.order_id ?? null,
    customer_name: fields.customer_name ?? null,
    customer_id: fields.customer_id ?? null,
    address: fields.address ?? null,
    city_state_zip: fields.city_state_zip ?? null,
    phone: fields.phone ?? null,
    delivery_date: fields.delivery_date ?? null,
    salesperson: fields.salesperson ?? null,
    truck_id: fields.truck_id ?? null,
    total_sale: fields.total_sale ?? null,
  };
}

export function calculateConfidence(fields: FinsalesData): number {
  const values = Object.values(fields);
  const populated = values.filter((v) => v !== null).length;
  return populated / values.length;
}

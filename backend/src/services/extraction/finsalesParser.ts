import { FinsalesData } from './types';
import { extractHeader, uppercaseFields } from './headerParser';
import { hasFinancingContent, extractFinancingBody } from './financingParser';

export { uppercaseFields, calculateConfidence };

export function parseFinsalesPage(rawText: string): FinsalesData {
  const header = extractHeader(rawText);

  const base: FinsalesData = {
    fulfillment: header.fulfillment ?? null,
    order_type: header.order_type ?? null,
    order_id: header.order_id ?? null,
    customer_name: header.customer_name ?? null,
    customer_id: null,
    address: header.address ?? null,
    city_state_zip: header.city_state_zip ?? null,
    ship_to_name: null,
    ship_to_address: null,
    ship_to_city_state_zip: null,
    phone: header.phone ?? null,
    delivery_date: header.delivery_date ?? null,
    salesperson: header.salesperson ?? null,
    truck_id: null,
    total_sale: null,
    stat: header.stat ?? null,
    stop: null,
    zone: header.zone ?? null,
    customer_code: header.customer_code ?? null,
    finance_company: null,
    financed_amount: null,
  };

  const hasLineItems = /Gross\s+Sales/i.test(rawText);
  if (hasLineItems) {
    Object.assign(base, extractDetailBody(rawText));
  }

  if (hasFinancingContent(rawText)) {
    Object.assign(base, extractFinancingBody(rawText));
  }

  return uppercaseFields(base);
}

export function extractDetailBody(rawText: string): { total_sale: string | null } {
  return { total_sale: extractTotal(rawText) };
}

function extractTotal(text: string): string | null {
  const match = text.match(/Gross\s*Sales?:?\s*\$?\s*([\d,.]+)/i);
  return match?.[1]?.trim() ?? null;
}

function calculateConfidence(fields: FinsalesData): number {
  const values = Object.values(fields);
  const populated = values.filter((v) => v !== null).length;
  return populated / values.length;
}

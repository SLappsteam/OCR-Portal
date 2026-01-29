export interface FinsalesData {
  ticket_type: string | null;
  order_type: string | null;
  order_id: string | null;
  customer_name: string | null;
  customer_id: string | null;
  address: string | null;
  city_state_zip: string | null;
  phone: string | null;
  delivery_date: string | null;
  salesperson: string | null;
  truck_id: string | null;
  total_sale: string | null;
}

export interface ExtractionResult {
  document_type: string;
  fields: FinsalesData;
  confidence: number;
  raw_text: string;
}

export interface PageExtractionResult {
  page_number: number;
  document_type: string;
  fields: FinsalesData;
  confidence: number;
  raw_text: string;
}

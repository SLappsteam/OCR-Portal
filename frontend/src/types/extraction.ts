export interface SummaryOrder {
  order_id: string;
  customer_name: string;
}

export interface FinsalesFields {
  document_type?: string;
  orders?: SummaryOrder[];
  order_type?: string;
  order_id?: string;
  customer_name?: string;
  customer_id?: string;
  address?: string;
  city_state_zip?: string;
  ship_to_name?: string;
  ship_to_address?: string;
  ship_to_city_state_zip?: string;
  phone?: string;
  delivery_date?: string;
  salesperson?: string;
  truck_id?: string;
  total_sale?: string;
  stat?: string;
  stop?: string;
  zone?: string;
  customer_code?: string;
  finance_company?: string;
  financed_amount?: string;
}

export interface PageExtractionRecord {
  id: number;
  document_id: number;
  page_number: number;
  fields: FinsalesFields;
  confidence: number;
  raw_text: string;
  created_at: string;
}

export interface PageSearchResult {
  document_id: number;
  page_number: number;
  fields: FinsalesFields;
  confidence: number;
  document_reference: string | null;
  document_type_code: string | null;
  document_type_name: string | null;
  store_number: string;
  batch_id: number;
  batch_reference: string | null;
  batch_type: string | null;
  root_batch_id: number;
  created_at: string;
}

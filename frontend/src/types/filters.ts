export interface FieldFilter {
  field: string;
  value: string;
}

export interface FilterableField {
  field: string;
  label: string;
}

export const FILTERABLE_FIELDS: FilterableField[] = [
  { field: 'customer_name', label: 'Customer Name' },
  { field: 'customer_id', label: 'Customer ID' },
  { field: 'order_id', label: 'Order ID' },
  { field: 'phone', label: 'Phone' },
  { field: 'order_type', label: 'Order Type' },
  { field: 'salesperson', label: 'Salesperson' },
  { field: 'stat', label: 'Stat' },
  { field: 'zone', label: 'Zone' },
  { field: 'fulfillment_type', label: 'Fulfillment Type' },
  { field: 'customer_code', label: 'Customer Code' },
];

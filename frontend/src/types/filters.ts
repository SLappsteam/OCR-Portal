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
  { field: 'fulfillment', label: 'Fulfillment' },
  { field: 'salesperson', label: 'Salesperson' },
  { field: 'stat', label: 'Stat' },
  { field: 'zone', label: 'Zone' },
  { field: 'customer_code', label: 'Customer Code' },
  { field: 'order_type', label: 'Order Type' },
  { field: 'address', label: 'Address' },
  { field: 'city_state_zip', label: 'City/State/Zip' },
  { field: 'ship_to_name', label: 'Ship To Name' },
  { field: 'ship_to_address', label: 'Ship To Address' },
  { field: 'ship_to_city_state_zip', label: 'Ship To City/State/Zip' },
  { field: 'delivery_date', label: 'Delivery Date' },
  { field: 'truck_id', label: 'Truck ID' },
  { field: 'total_sale', label: 'Total Sale' },
  { field: 'stop', label: 'Stop' },
  { field: 'finance_company', label: 'Finance Company' },
  { field: 'financed_amount', label: 'Financed Amount' },
  { field: 'grand_total', label: 'Grand Total' },
  { field: 'total_refund', label: 'Total Refund' },
  { field: 'payment_site', label: 'Payment Site' },
  { field: 'post_date', label: 'Post Date' },
];

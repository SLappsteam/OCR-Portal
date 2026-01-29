import type { FinsalesFields } from '../types/extraction';

interface ExtractionFieldsProps {
  fields: FinsalesFields;
}

const FIELD_LABELS: Record<keyof FinsalesFields, string> = {
  order_id: 'Order ID',
  customer_name: 'Customer Name',
  customer_id: 'Customer ID',
  address: 'Address',
  city_state_zip: 'City/State/Zip',
  phone: 'Phone',
  delivery_date: 'Delivery Date',
  salesperson: 'Salesperson',
  truck_id: 'Truck ID',
  total_sale: 'Total Sale',
};

export function ExtractionFields({ fields }: ExtractionFieldsProps) {
  const entries = Object.entries(FIELD_LABELS) as [keyof FinsalesFields, string][];
  const populatedFields = entries.filter(([key]) => fields[key]);

  if (populatedFields.length === 0) {
    return (
      <p className="text-gray-400 text-sm italic">No extracted data for this page</p>
    );
  }

  return (
    <div className="space-y-2">
      {populatedFields.map(([key, label]) => (
        <div key={key}>
          <label className="text-gray-500 text-xs">{label}</label>
          <p className="font-medium text-sm">{fields[key]}</p>
        </div>
      ))}
    </div>
  );
}

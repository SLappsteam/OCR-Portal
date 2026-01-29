import type { FinsalesFields } from '../types/extraction';

interface ExtractionFieldsProps {
  fields: FinsalesFields;
}

const FIELD_LABELS: Record<string, string> = {
  document_type: 'Document Type',
  ticket_type: 'Ticket Type',
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
  if (fields.orders && fields.orders.length > 0) {
    return <OrdersSummary orders={fields.orders} />;
  }

  const entries = Object.entries(FIELD_LABELS);
  const populated = entries.filter(
    ([key]) => fields[key as keyof FinsalesFields]
  );

  if (populated.length === 0) {
    return (
      <p className="text-gray-400 text-sm italic">No extracted data for this page</p>
    );
  }

  return (
    <div className="space-y-2">
      {populated.map(([key, label]) => (
        <div key={key}>
          <label className="text-gray-500 text-xs">{label}</label>
          <p className="font-medium text-sm">
            {fields[key as keyof FinsalesFields] as string}
          </p>
        </div>
      ))}
    </div>
  );
}

function OrdersSummary({ orders }: { orders: FinsalesFields['orders'] }) {
  return (
    <div>
      <p className="text-gray-500 text-xs mb-2">
        {orders!.length} order{orders!.length !== 1 ? 's' : ''} on this page
      </p>
      <div className="space-y-1.5 max-h-64 overflow-y-auto">
        {orders!.map((o, i) => (
          <div key={i} className="flex justify-between gap-2 text-sm border-b border-gray-50 pb-1">
            <span className="font-mono text-xs text-gray-600 shrink-0">
              {o.order_id}
            </span>
            <span className="font-medium text-right truncate">
              {o.customer_name}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

import {
  Calculator,
  FileText,
  Package,
  RefreshCcw,
  Wallet,
  ShoppingCart,
  CreditCard,
  Landmark,
  HelpCircle,
  FileQuestion,
} from 'lucide-react';

export const docTypeIcons: Record<string, { icon: React.ElementType; color: string }> = {
  CDR: { icon: Calculator, color: 'bg-blue-100 text-blue-600' },
  APINV: { icon: FileText, color: 'bg-purple-100 text-purple-600' },
  ATOMRCV: { icon: Package, color: 'bg-orange-100 text-orange-600' },
  MTOZRCV: { icon: Package, color: 'bg-orange-100 text-orange-600' },
  LBRCV: { icon: Package, color: 'bg-amber-100 text-amber-600' },
  REFUND: { icon: RefreshCcw, color: 'bg-red-100 text-red-600' },
  EXPENSE: { icon: Wallet, color: 'bg-emerald-100 text-emerald-600' },
  FINSALES: { icon: ShoppingCart, color: 'bg-green-100 text-green-600' },
  FINTRAN: { icon: CreditCard, color: 'bg-indigo-100 text-indigo-600' },
  LOFTFIN: { icon: CreditCard, color: 'bg-violet-100 text-violet-600' },
  WFDEP: { icon: Landmark, color: 'bg-yellow-100 text-yellow-600' },
  OTHER: { icon: FileQuestion, color: 'bg-gray-100 text-gray-600' },
  UNCLASSIFIED: { icon: HelpCircle, color: 'bg-gray-100 text-gray-400' },
};

export interface DocumentRow {
  id: number;
  reference: string | null;
  status: string;
  page_start: number;
  page_end: number;
  created_at: string;
  batch: {
    store: { store_number: string };
  };
  documentType: { name: string; code: string } | null;
  extraction_fields: Record<string, string | undefined> | null;
}

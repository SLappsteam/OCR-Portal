import {
  FileText,
  ClipboardList,
  HelpCircle,
} from 'lucide-react';

// Document types - classify page content (not batch type)
export const docTypeIcons: Record<string, { icon: React.ElementType; color: string }> = {
  INVOICE: { icon: FileText, color: 'bg-green-100 text-green-600' },
  MANIFEST: { icon: ClipboardList, color: 'bg-cyan-100 text-cyan-600' },
  UNKNOWN: { icon: HelpCircle, color: 'bg-gray-100 text-gray-400' },
};

export interface DocumentRow {
  id: number;
  reference: string | null;
  status: string;
  page_number: number;
  created_at: string;
  confidence: number | null;
  batch: {
    id: number;
    reference: string | null;
    batch_type: string | null;
    store: { store_number: string };
  };
  documentType: { name: string; code: string } | null;
  extraction_fields: Record<string, string | undefined> | null;
}

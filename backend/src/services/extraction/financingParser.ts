export function hasFinancingContent(rawText: string): boolean {
  return /CUSTOMER\s+SIGNATURE/i.test(rawText);
}

export function extractFinancingBody(
  rawText: string
): { finance_company: string | null; financed_amount: string | null } {
  return {
    finance_company: extractFinanceCompany(rawText),
    financed_amount: extractFinancedAmount(rawText),
  };
}

function extractFinanceCompany(text: string): string | null {
  const match = text.match(/Finance\s+Co\.?:\s*(.+)/i);
  return match?.[1]?.trim() ?? null;
}

function extractFinancedAmount(text: string): string | null {
  const match = text.match(/Financed\s+Amt\.?:\s*\$?([\d,.]+)/i);
  return match?.[1]?.trim() ?? null;
}

const DEPOSIT_TICKET_PATTERN = /DEPOSIT\s+TICKET/i;

export function isDepositTicket(rawText: string): boolean {
  return DEPOSIT_TICKET_PATTERN.test(rawText);
}

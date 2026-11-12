export type Subscriber = {
  id: number | string;
  name: string;
  email: string;
  accountType: string;
  plan: string;
  planName: string;
  price: number | null;
  status: string;
  createdAt: string;
  suspended: boolean;
};
export type Payment = {
  id: number | string;
  reference: string;
  subscriberName: string;
  subscriberEmail: string;
  planName: string;
  amount: number;
  currency: string;
  transactionDate: string;
  status: string;
};
export const memberTypes: Record<string, string> = {
  broker: 'Licensed Broker',
  agency: 'Real Estate Agency',
  developer: 'Property Developer',
};
export const statuses: Record<string, string> = {
  active: 'Active',
  pending: 'Pending',
  past_due: 'Past Due',
  suspended: 'Suspended',
  cancelled: 'Cancelled',
  paid: 'Paid',
  failed: 'Failed',
};
export function monthlySummary(payments: Payment[], now = new Date()) {
  const month = (date: Date) =>
    new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Colombo', year: 'numeric', month: '2-digit' }).format(date);
  const current = payments.filter((payment) => month(new Date(payment.transactionDate)) === month(now));
  return {
    revenue:
      current
        .filter((payment) => payment.status === 'paid')
        .reduce((total, payment) => total + Math.round(payment.amount * 100), 0) / 100,
    successful: current.filter((payment) => payment.status === 'paid').length,
    failed: current.filter((payment) => payment.status === 'failed').length,
  };
}
export function csvText(rows: unknown[][]) {
  return (
    '\ufeff' +
    rows
      .map((row) =>
        row
          .map((value) => {
            const text = String(value ?? '');
            const safe = /^[\s]*[=+\-@]/.test(text) ? `'${text}` : text;
            return `"${safe.replace(/"/g, '""')}"`;
          })
          .join(','),
      )
      .join('\r\n')
  );
}
export function money(value: number | null) {
  return value == null ? 'To be confirmed' : `AED ${value.toLocaleString('en-AE', { maximumFractionDigits: 2 })}`;
}

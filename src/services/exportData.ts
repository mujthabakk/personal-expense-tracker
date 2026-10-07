import { combineDate, localDay, monthKey, toISODate } from '@/lib/dates';
import { formatMoney } from '@/lib/money';
import type { PersistedState, Transaction } from '@/models/types';
import { spendingByCategory, summarizeMonth, totalsFor } from '@/services/finance';

export interface CsvRow {
  date: string;
  type: string;
  amount: string | number;
  category: string;
  account: string;
  paymentMethod: string;
  description: string;
  notes: string;
}

export function toCsv(transactions: Transaction[], state: Pick<PersistedState, 'categories' | 'accounts'>): string {
  const header = ['Date', 'Type', 'Amount', 'Category', 'Account', 'Payment method', 'Description', 'Notes'];
  const lines = [header.join(',')];
  for (const transaction of transactions) {
    const category = state.categories.find((item) => item.id === transaction.categoryId)?.name ?? '';
    const account = state.accounts.find((item) => item.id === transaction.accountId)?.name ?? '';
    lines.push(
      [
        localDay(transaction.date),
        transaction.type,
        transaction.amount,
        category,
        account,
        transaction.paymentMethod,
        transaction.description,
        transaction.notes,
      ]
        .map(csvCell)
        .join(','),
    );
  }
  return `\uFEFF${lines.join('\n')}`;
}

function csvCell(value: string | number): string {
  const text = String(value ?? '');
  if (/[",\n]/.test(text)) return `"${text.replaceAll('"', '""')}"`;
  return text;
}

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  const source = text.replace(/^\uFEFF/, '');
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (quoted) {
      if (char === '"') {
        if (source[index + 1] === '"') {
          cell += '"';
          index += 1;
        } else quoted = false;
      } else cell += char;
    } else if (char === '"') quoted = true;
    else if (char === ',') {
      row.push(cell);
      cell = '';
    } else if (char === '\n') {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else if (char !== '\r') cell += char;
  }
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((entry) => entry.some((value) => value.trim()));
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export async function exportTransactions(options: {
  format: 'csv' | 'xlsx' | 'pdf';
  transactions: Transaction[];
  state: PersistedState;
  title: string;
}) {
  const { format, transactions, state, title } = options;
  const stamp = toISODate(new Date());
  if (format === 'csv') {
    downloadBlob(new Blob([toCsv(transactions, state)], { type: 'text/csv;charset=utf-8' }), `folio-${stamp}.csv`);
    return;
  }
  if (format === 'xlsx') {
    const XLSX = await import('xlsx');
    const rows = transactions.map((transaction) => ({
      Date: localDay(transaction.date),
      Type: transaction.type,
      Amount: transaction.amount,
      Category: state.categories.find((item) => item.id === transaction.categoryId)?.name ?? '',
      Account: state.accounts.find((item) => item.id === transaction.accountId)?.name ?? '',
      'Payment method': transaction.paymentMethod,
      Description: transaction.description,
      Notes: transaction.notes,
    }));
    const book = XLSX.utils.book_new();
    const summary = summarizeMonth(transactions, state.categories, monthKey(new Date()));
    XLSX.utils.book_append_sheet(
      book,
      XLSX.utils.json_to_sheet([
        { Metric: 'Income', Value: summary.income },
        { Metric: 'Expenses', Value: summary.expense },
        { Metric: 'Savings', Value: summary.savings },
      ]),
      'Summary',
    );
    XLSX.utils.book_append_sheet(book, XLSX.utils.json_to_sheet(rows), 'Transactions');
    XLSX.writeFile(book, `folio-${stamp}.xlsx`);
    return;
  }

  const { jsPDF } = await import('jspdf');
  const autoTable = (await import('jspdf-autotable')).default;
  const doc = new jsPDF();
  const totals = totalsFor(transactions);
  const top = spendingByCategory(transactions, state.categories)[0];
  doc.setFontSize(18);
  doc.text('Folio', 14, 18);
  doc.setFontSize(11);
  doc.text(title, 14, 26);
  doc.text(`Income ${formatMoney(totals.income, state.settings.currency, state.settings.language)}`, 14, 36);
  doc.text(`Expenses ${formatMoney(totals.expense, state.settings.currency, state.settings.language)}`, 14, 42);
  doc.text(`Savings ${formatMoney(totals.savings, state.settings.currency, state.settings.language)}`, 14, 48);
  if (top) doc.text(`Top category ${top.name}`, 14, 54);
  autoTable(doc, {
    startY: 62,
    head: [['Date', 'Type', 'Category', 'Description', 'Amount']],
    body: transactions.map((transaction) => [
      localDay(transaction.date),
      transaction.type,
      state.categories.find((item) => item.id === transaction.categoryId)?.name ?? '',
      transaction.description,
      formatMoney(transaction.amount, state.settings.currency, state.settings.language),
    ]),
    styles: { fontSize: 9 },
    headStyles: { fillColor: [23, 27, 34] },
  });
  doc.save(`folio-${stamp}.pdf`);
}

export function monthRange(today = new Date()): { from: string; to: string } {
  const month = monthKey(today);
  const [year, monthIndex] = month.split('-').map(Number);
  const last = new Date(year, monthIndex, 0).getDate();
  return { from: `${month}-01`, to: `${month}-${String(last).padStart(2, '0')}` };
}

export function stampTransaction(partial: Omit<Transaction, 'createdAt' | 'updatedAt' | 'id'> & { id?: string }): Transaction {
  const stamp = new Date().toISOString();
  return {
    ...partial,
    date: partial.date.includes('T') ? partial.date : combineDate(partial.date),
    id: partial.id ?? crypto.randomUUID(),
    createdAt: stamp,
    updatedAt: stamp,
  };
}

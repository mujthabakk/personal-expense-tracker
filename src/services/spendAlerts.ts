import { shiftMonth } from '@/lib/dates';
import type { Budget, Category, Transaction } from '@/models/types';
import { isInMonth, resolvedBudgets, spendingByCategory, totalsFor } from '@/services/finance';

const UNWANTED = new Set(['cat-shopping', 'cat-entertainment', 'cat-subscriptions', 'cat-personal-care']);

export interface FlaggedItem {
  id: string;
  label: string;
  amount: number;
  category: string;
}

export interface SpendAlert {
  id: string;
  tone: 'warning' | 'bad';
  title: string;
  detail: string;
  items: FlaggedItem[];
}

export function monthExpenses(transactions: Transaction[], month: string): Transaction[] {
  return transactions.filter((item) => item.type === 'expense' && isInMonth(item.date, month));
}

export function buildSpendAlerts(
  transactions: Transaction[],
  categories: Category[],
  budgets: Budget[],
  month: string,
): SpendAlert[] {
  const alerts: SpendAlert[] = [];
  const expenses = monthExpenses(transactions, month);
  const totals = totalsFor(transactions, month);
  const spend = spendingByCategory(transactions, categories, month);
  const previous = spendingByCategory(transactions, categories, shiftMonth(month, -1));

  if (totals.expense > totals.income && totals.expense > 0) {
    alerts.push({
      id: 'over-income',
      tone: 'bad',
      title: 'Spent more than you earned',
      detail: 'Expenses are higher than income this month.',
      items: largest(expenses, categories, 3),
    });
  }

  for (const row of resolvedBudgets({ budgets, categories, transactions }, month)) {
    if (row.status === 'ok') continue;
    const items = row.categoryId
      ? expenses.filter((item) => item.categoryId === row.categoryId).map((item) => toItem(item, categories))
      : largest(expenses, categories, 3);
    alerts.push({
      id: `budget-${row.id}`,
      tone: row.status === 'exceeded' ? 'bad' : 'warning',
      title: row.status === 'exceeded' ? `${row.name} is over budget` : `${row.name} is close to its budget`,
      detail: row.status === 'exceeded' ? 'Spending passed the limit you set.' : 'Spending has reached most of the limit.',
      items,
    });
  }

  for (const item of spend) {
    if (!UNWANTED.has(item.categoryId) || item.amount <= 0) continue;
    alerts.push({
      id: `unwanted-${item.categoryId}`,
      tone: 'warning',
      title: `Unwanted spending: ${item.name}`,
      detail: 'These purchases are easy to cut. They are not rent, bills, groceries, health, or investment.',
      items: expenses.filter((entry) => entry.categoryId === item.categoryId).map((entry) => toItem(entry, categories)),
    });
  }

  for (const item of spend) {
    const before = previous.find((entry) => entry.categoryId === item.categoryId)?.amount ?? 0;
    if (before < 100 || item.amount < 500) continue;
    const pct = Math.round(((item.amount - before) / before) * 100);
    if (pct < 20) continue;
    alerts.push({
      id: `more-${item.categoryId}`,
      tone: 'warning',
      title: `Spending more on ${item.name}`,
      detail: `${pct}% more than last month.`,
      items: expenses.filter((entry) => entry.categoryId === item.categoryId).slice(0, 4).map((entry) => toItem(entry, categories)),
    });
  }

  return alerts;
}

export function investmentAmount(transactions: Transaction[], categories: Category[], month: string): number {
  const match = categories.find((category) => category.id === 'cat-investment' || category.name.toLowerCase() === 'investment');
  if (!match) return 0;
  return spendingByCategory(transactions, categories, month).find((item) => item.categoryId === match.id)?.amount ?? 0;
}

function toItem(transaction: Transaction, categories: Category[]): FlaggedItem {
  const category = categories.find((item) => item.id === transaction.categoryId);
  return {
    id: transaction.id,
    label: transaction.description.trim() || category?.name || 'Expense',
    amount: transaction.amount,
    category: category?.name ?? 'Expense',
  };
}

function largest(transactions: Transaction[], categories: Category[], count: number): FlaggedItem[] {
  return [...transactions].sort((a, b) => b.amount - a.amount).slice(0, count).map((item) => toItem(item, categories));
}

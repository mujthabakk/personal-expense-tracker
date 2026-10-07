import { daysBetween, localDay, localMonth, monthKey, monthsRemaining, rangesOverlap, shiftMonth, toISODate } from '@/lib/dates';
import { formatChange, roundMoney } from '@/lib/money';
import type {
  Account,
  Budget,
  Category,
  PersistedState,
  SavingsGoal,
  Transaction,
  TransactionType,
} from '@/models/types';

export type BudgetStatus = 'ok' | 'warning' | 'exceeded';
export const BUDGET_WARNING_RATIO = 0.8;

export interface CategorySpend {
  categoryId: string;
  name: string;
  color: string;
  icon: string;
  amount: number;
  percent: number;
}

export interface BudgetRow {
  id: string;
  name: string;
  color: string;
  icon: string;
  spent: number;
  limit: number;
  percent: number;
  status: BudgetStatus;
  kind: Budget['kind'];
  categoryId: string;
  budgetId: string;
}

export interface MonthSummary {
  month: string;
  income: number;
  expense: number;
  savings: number;
  savingsRate: number;
  topCategory: string;
  largestExpenseName: string;
  largestExpenseAmount: number;
  incomeChange: string;
  expenseChange: string;
  savingsChange: string;
}

export interface ChartPoint {
  key: string;
  label: string;
  income: number;
  expense: number;
  savings: number;
}

export function isInMonth(date: string, month: string): boolean {
  return localMonth(date) === month;
}

export function computeAccountBalance(account: Account, transactions: Transaction[]): number {
  let balance = account.openingBalance;
  const card = account.type === 'credit_card';
  for (const transaction of transactions) {
    if (transaction.type === 'income' && transaction.accountId === account.id) {
      balance += card ? -transaction.amount : transaction.amount;
    } else if (transaction.type === 'expense' && transaction.accountId === account.id) {
      balance += card ? transaction.amount : -transaction.amount;
    } else if (transaction.type === 'transfer' && transaction.accountId === account.id) {
      balance += card ? transaction.amount : -transaction.amount;
    } else if (transaction.type === 'transfer' && transaction.toAccountId === account.id) {
      balance += card ? -transaction.amount : transaction.amount;
    }
  }
  return roundMoney(balance);
}

export function netWorth(accounts: Account[], transactions: Transaction[]): number {
  return roundMoney(
    accounts.reduce((sum, account) => {
      const balance = computeAccountBalance(account, transactions);
      return sum + (account.type === 'credit_card' ? -balance : balance);
    }, 0),
  );
}

export function totalsFor(transactions: Transaction[], month?: string) {
  let income = 0;
  let expense = 0;
  for (const transaction of transactions) {
    if (month && !isInMonth(transaction.date, month)) continue;
    if (transaction.type === 'income') income += transaction.amount;
    if (transaction.type === 'expense') expense += transaction.amount;
  }
  income = roundMoney(income);
  expense = roundMoney(expense);
  const savings = roundMoney(income - expense);
  const savingsRate = income > 0 ? (savings / income) * 100 : 0;
  return { income, expense, savings, savingsRate };
}

export function spendingByCategory(transactions: Transaction[], categories: Category[], month?: string): CategorySpend[] {
  const totals = new Map<string, number>();
  for (const transaction of transactions) {
    if (transaction.type !== 'expense') continue;
    if (month && !isInMonth(transaction.date, month)) continue;
    totals.set(transaction.categoryId, (totals.get(transaction.categoryId) ?? 0) + transaction.amount);
  }
  const expense = [...totals.values()].reduce((sum, value) => sum + value, 0);
  return [...totals.entries()]
    .map(([categoryId, amount]) => {
      const category = categories.find((item) => item.id === categoryId);
      return {
        categoryId,
        name: category?.name ?? 'Uncategorized',
        color: category?.color ?? '#334155',
        icon: category?.icon ?? 'circle',
        amount: roundMoney(amount),
        percent: expense > 0 ? (amount / expense) * 100 : 0,
      };
    })
    .sort((a, b) => b.amount - a.amount);
}

export function budgetStatus(spent: number, limit: number): BudgetStatus {
  if (limit <= 0) return 'ok';
  const ratio = spent / limit;
  if (ratio >= 1) return 'exceeded';
  if (ratio >= BUDGET_WARNING_RATIO) return 'warning';
  return 'ok';
}

export function spentForCategory(transactions: Transaction[], month: string, categoryId: string): number {
  return roundMoney(
    transactions.reduce((sum, transaction) => {
      if (transaction.type !== 'expense' || transaction.categoryId !== categoryId || !isInMonth(transaction.date, month)) return sum;
      return sum + transaction.amount;
    }, 0),
  );
}

export function resolvedBudgets(state: Pick<PersistedState, 'budgets' | 'categories' | 'transactions'>, month: string): BudgetRow[] {
  const rows: BudgetRow[] = [];
  const monthly = state.budgets.find((budget) => budget.kind === 'monthly' && budget.month === month);
  if (monthly) {
    const spent = totalsFor(state.transactions, month).expense;
    const percent = monthly.amount > 0 ? (spent / monthly.amount) * 100 : 0;
    rows.push({
      id: monthly.id,
      budgetId: monthly.id,
      name: monthly.name || 'Monthly budget',
      color: '#1d4e89',
      icon: 'wallet',
      spent,
      limit: monthly.amount,
      percent,
      status: budgetStatus(spent, monthly.amount),
      kind: 'monthly',
      categoryId: '',
    });
  }

  for (const category of state.categories.filter((item) => item.type === 'expense')) {
    const override = state.budgets.find((budget) => budget.kind === 'category' && budget.categoryId === category.id && budget.month === month);
    const limit = override?.amount ?? category.budgetAmount;
    if (limit <= 0) continue;
    const spent = spentForCategory(state.transactions, month, category.id);
    rows.push({
      id: override?.id ?? `template:${category.id}`,
      budgetId: override?.id ?? '',
      name: category.name,
      color: category.color,
      icon: category.icon,
      spent,
      limit,
      percent: (spent / limit) * 100,
      status: budgetStatus(spent, limit),
      kind: 'category',
      categoryId: category.id,
    });
  }

  for (const budget of state.budgets.filter((item) => item.kind === 'custom' && rangesOverlap(item.startDate, item.endDate, month))) {
    const spent = budget.categoryId
      ? spentForCategory(state.transactions, month, budget.categoryId)
      : totalsFor(state.transactions, month).expense;
    const category = state.categories.find((item) => item.id === budget.categoryId);
    rows.push({
      id: budget.id,
      budgetId: budget.id,
      name: budget.name,
      color: category?.color ?? '#334155',
      icon: category?.icon ?? 'target',
      spent,
      limit: budget.amount,
      percent: budget.amount > 0 ? (spent / budget.amount) * 100 : 0,
      status: budgetStatus(spent, budget.amount),
      kind: 'custom',
      categoryId: budget.categoryId,
    });
  }

  return rows;
}

export function summarizeMonth(transactions: Transaction[], categories: Category[], month: string): MonthSummary {
  const current = totalsFor(transactions, month);
  const previous = totalsFor(transactions, shiftMonth(month, -1));
  const spend = spendingByCategory(transactions, categories, month);
  let largestExpenseName = '—';
  let largestExpenseAmount = 0;
  for (const transaction of transactions) {
    if (transaction.type !== 'expense' || !isInMonth(transaction.date, month)) continue;
    if (transaction.amount > largestExpenseAmount) {
      largestExpenseAmount = transaction.amount;
      const category = categories.find((item) => item.id === transaction.categoryId);
      largestExpenseName = transaction.description || category?.name || 'Expense';
    }
  }
  return {
    month,
    ...current,
    topCategory: spend[0]?.name ?? '—',
    largestExpenseName,
    largestExpenseAmount,
    incomeChange: formatChange(current.income, previous.income),
    expenseChange: formatChange(current.expense, previous.expense),
    savingsChange: formatChange(current.savings, previous.savings),
  };
}

export function transactionTitle(transaction: Transaction, categories: Category[]): string {
  if (transaction.description.trim()) return transaction.description.trim();
  if (transaction.type === 'transfer') return 'Transfer';
  return categories.find((item) => item.id === transaction.categoryId)?.name ?? 'Transaction';
}

export function transactionMatches(
  transaction: Transaction,
  query: string,
  categories: Category[],
  accounts: Account[],
): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  const category = categories.find((item) => item.id === transaction.categoryId);
  const account = accounts.find((item) => item.id === transaction.accountId);
  const destination = accounts.find((item) => item.id === transaction.toAccountId);
  const haystack = [
    transaction.description,
    transaction.notes,
    transaction.paymentMethod.replaceAll('_', ' '),
    transaction.type,
    String(transaction.amount),
    category?.name,
    account?.name,
    destination?.name,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return haystack.includes(needle);
}

export type SortKey = 'date_desc' | 'date_asc' | 'amount_desc' | 'amount_asc';

export function sortTransactions(transactions: Transaction[], sort: SortKey): Transaction[] {
  const copy = [...transactions];
  copy.sort((a, b) => {
    if (sort === 'amount_desc') return b.amount - a.amount;
    if (sort === 'amount_asc') return a.amount - b.amount;
    const date = a.date.localeCompare(b.date);
    if (sort === 'date_asc') return date || a.createdAt.localeCompare(b.createdAt);
    return (date === 0 ? b.createdAt.localeCompare(a.createdAt) : -date);
  });
  return copy;
}

export function groupByDate(transactions: Transaction[]): Array<{ date: string; items: Transaction[] }> {
  const groups: Array<{ date: string; items: Transaction[] }> = [];
  for (const transaction of transactions) {
    const date = localDay(transaction.date);
    const last = groups[groups.length - 1];
    if (last?.date === date) last.items.push(transaction);
    else groups.push({ date, items: [transaction] });
  }
  return groups;
}

export interface ReportBucket {
  key: string;
  label: string;
  start: string;
  end: string;
}

function weekStart(date: Date): Date {
  const copy = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = copy.getDay();
  const offset = day === 0 ? 6 : day - 1;
  copy.setDate(copy.getDate() - offset);
  return copy;
}

export function reportBuckets(period: 'daily' | 'weekly' | 'monthly' | 'yearly', today = new Date()): ReportBucket[] {
  if (period === 'daily') {
    const month = monthKey(today);
    const [year, monthIndex] = month.split('-').map(Number);
    const last = new Date(year, monthIndex, 0).getDate();
    const endDay = today.getMonth() + 1 === monthIndex && today.getFullYear() === year ? today.getDate() : last;
    return Array.from({ length: endDay }, (_, index) => {
      const day = String(index + 1).padStart(2, '0');
      const key = `${month}-${day}`;
      return { key, label: String(index + 1), start: key, end: key };
    });
  }
  if (period === 'weekly') {
    const start = weekStart(today);
    return Array.from({ length: 8 }, (_, index) => {
      const from = new Date(start);
      from.setDate(start.getDate() - (7 - index) * 7);
      const to = new Date(from);
      to.setDate(from.getDate() + 6);
      return {
        key: toISODate(from),
        label: `${from.getDate()}/${from.getMonth() + 1}`,
        start: toISODate(from),
        end: toISODate(to),
      };
    });
  }
  if (period === 'yearly') {
    return Array.from({ length: 5 }, (_, index) => {
      const year = today.getFullYear() - (4 - index);
      return { key: String(year), label: String(year), start: `${year}-01-01`, end: `${year}-12-31` };
    });
  }
  return Array.from({ length: 12 }, (_, index) => {
    const month = shiftMonth(monthKey(today), index - 11);
    const [year, monthIndex] = month.split('-').map(Number);
    const last = new Date(year, monthIndex, 0).getDate();
    return {
      key: month,
      label: new Date(year, monthIndex - 1, 1).toLocaleString('en', { month: 'short' }),
      start: `${month}-01`,
      end: `${month}-${String(last).padStart(2, '0')}`,
    };
  });
}

export function chartSeries(transactions: Transaction[], buckets: ReportBucket[]): ChartPoint[] {
  return buckets.map((bucket) => {
    let income = 0;
    let expense = 0;
    for (const transaction of transactions) {
      const day = localDay(transaction.date);
      if (day < bucket.start || day > bucket.end) continue;
      if (transaction.type === 'income') income += transaction.amount;
      if (transaction.type === 'expense') expense += transaction.amount;
    }
    return {
      key: bucket.key,
      label: bucket.label,
      income: roundMoney(income),
      expense: roundMoney(expense),
      savings: roundMoney(income - expense),
    };
  });
}

export function transactionsInRange(transactions: Transaction[], from: string, to: string): Transaction[] {
  return transactions.filter((transaction) => {
    const day = localDay(transaction.date);
    return (!from || day >= from) && (!to || day <= to);
  });
}

export function goalMonthlyNeed(goal: Pick<SavingsGoal, 'targetAmount' | 'currentAmount' | 'targetDate'>, today = new Date()): number {
  const remaining = roundMoney(goal.targetAmount - goal.currentAmount);
  if (remaining <= 0) return 0;
  const months = monthsRemaining(goal.targetDate, today);
  if (months <= 0) return remaining;
  return roundMoney(remaining / months);
}

export function goalProgress(goal: Pick<SavingsGoal, 'targetAmount' | 'currentAmount'>): number {
  if (goal.targetAmount <= 0) return 0;
  return Math.min(100, (goal.currentAmount / goal.targetAmount) * 100);
}

export function accountFlow(accountId: string, transactions: Transaction[]) {
  let income = 0;
  let expense = 0;
  for (const transaction of transactions) {
    if (transaction.type === 'income' && transaction.accountId === accountId) income += transaction.amount;
    if (transaction.type === 'expense' && transaction.accountId === accountId) expense += transaction.amount;
  }
  return { income: roundMoney(income), expense: roundMoney(expense) };
}

export function reminderLabel(nextDate: string, today = new Date()): { days: number; overdue: boolean } {
  const days = daysBetween(toISODate(today), nextDate);
  return { days, overdue: days < 0 };
}

export function countByType(transactions: Transaction[], type: TransactionType | 'all'): Transaction[] {
  if (type === 'all') return transactions;
  return transactions.filter((transaction) => transaction.type === type);
}

export function dropImmediateTwins(transactions: Transaction[], windowMs = 2000): { kept: Transaction[]; removedIds: string[] } {
  const ordered = [...transactions].sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
  const kept: Transaction[] = [];
  const removedIds: string[] = [];
  for (const transaction of ordered) {
    const twin = kept.find((item) =>
      item.type === transaction.type
      && item.amount === transaction.amount
      && item.categoryId === transaction.categoryId
      && item.accountId === transaction.accountId
      && item.paymentMethod === transaction.paymentMethod
      && item.description === transaction.description
      && localDay(item.date) === localDay(transaction.date)
      && Math.abs(Date.parse(transaction.createdAt) - Date.parse(item.createdAt)) <= windowMs,
    );
    if (twin) removedIds.push(transaction.id);
    else kept.push(transaction);
  }
  return { kept, removedIds };
}

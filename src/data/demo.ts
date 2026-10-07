import { monthKey, shiftMonth, toISODate } from '@/lib/dates';
import { nowIso } from '@/lib/id';
import type { Account, Budget, PersistedState, RecurringRule, SavingsGoal, Transaction } from '@/models/types';

function at(month: string, day: number, hour = 10): string {
  const [year, monthIndex] = month.split('-').map(Number);
  return new Date(year, monthIndex - 1, day, hour).toISOString();
}

function txn(partial: Omit<Transaction, 'createdAt' | 'updatedAt' | 'toAccountId' | 'notes' | 'recurringTransactionId'> & Partial<Transaction>): Transaction {
  const stamp = partial.date;
  return {
    toAccountId: '',
    notes: '',
    recurringTransactionId: '',
    createdAt: stamp,
    updatedAt: stamp,
    ...partial,
  };
}

export function applyDemo(state: PersistedState, today = new Date()): PersistedState {
  const month = monthKey(today);
  const previous = shiftMonth(month, -1);
  const stamp = nowIso();
  const drop = (id: string) => id.startsWith('demo-');

  const accounts: Account[] = [
    ...state.accounts.filter((account) => !drop(account.id)),
    {
      id: 'demo-acc-hdfc',
      name: 'HDFC',
      type: 'bank',
      openingBalance: 38500,
      institution: 'HDFC Bank',
      color: '#1d4e89',
      icon: 'bank',
      isDefault: false,
      createdAt: stamp,
      updatedAt: stamp,
    },
    {
      id: 'demo-acc-savings',
      name: 'Savings Account',
      type: 'savings',
      openingBalance: 12000,
      institution: 'SBI',
      color: '#0f7a5a',
      icon: 'savings',
      isDefault: false,
      createdAt: stamp,
      updatedAt: stamp,
    },
  ];

  const cash = state.accounts.find((account) => account.id === 'acc-cash');
  if (cash) {
    const index = accounts.findIndex((account) => account.id === 'acc-cash');
    if (index >= 0) accounts[index] = { ...accounts[index], openingBalance: 4200, updatedAt: stamp };
  }

  const categories = state.categories.map((category) => {
    const amounts: Record<string, number> = { 'cat-food': 8000, 'cat-transport': 4000, 'cat-shopping': 5000 };
    if (!amounts[category.id]) return category;
    return { ...category, budgetAmount: amounts[category.id], updatedAt: stamp };
  });

  const transactions: Transaction[] = [
    txn({ id: 'demo-prev-salary', type: 'income', amount: 33000, categoryId: 'cat-salary', accountId: 'demo-acc-hdfc', paymentMethod: 'bank', description: 'Salary', date: at(previous, 1, 9) }),
    txn({ id: 'demo-prev-rent', type: 'expense', amount: 12000, categoryId: 'cat-rent', accountId: 'demo-acc-hdfc', paymentMethod: 'bank', description: 'Rent', date: at(previous, 2, 9) }),
    txn({ id: 'demo-prev-food', type: 'expense', amount: 1500, categoryId: 'cat-food', accountId: 'acc-cash', paymentMethod: 'upi', description: 'Swiggy', date: at(previous, 8, 20) }),
    txn({ id: 'demo-prev-transport', type: 'expense', amount: 2400, categoryId: 'cat-transport', accountId: 'acc-cash', paymentMethod: 'upi', description: 'Uber', date: at(previous, 12, 18) }),
    txn({ id: 'demo-salary', type: 'income', amount: 35000, categoryId: 'cat-salary', accountId: 'demo-acc-hdfc', paymentMethod: 'bank', description: 'Salary', date: at(month, 1, 9) }),
    txn({ id: 'demo-rent', type: 'expense', amount: 12000, categoryId: 'cat-rent', accountId: 'demo-acc-hdfc', paymentMethod: 'bank', description: 'Rent', date: at(month, 2, 9) }),
    txn({ id: 'demo-food-1', type: 'expense', amount: 250, categoryId: 'cat-food', accountId: 'acc-cash', paymentMethod: 'upi', description: 'Swiggy', date: at(month, 3, 21) }),
    txn({ id: 'demo-food-2', type: 'expense', amount: 420, categoryId: 'cat-food', accountId: 'acc-cash', paymentMethod: 'upi', description: 'Lunch', date: at(month, 6, 13) }),
    txn({ id: 'demo-groceries', type: 'expense', amount: 3200, categoryId: 'cat-groceries', accountId: 'demo-acc-hdfc', paymentMethod: 'upi', description: 'Groceries', date: at(month, 4, 11) }),
    txn({ id: 'demo-uber', type: 'expense', amount: 180, categoryId: 'cat-transport', accountId: 'acc-cash', paymentMethod: 'upi', description: 'Uber', date: at(month, 5, 19) }),
    txn({ id: 'demo-metro', type: 'expense', amount: 900, categoryId: 'cat-transport', accountId: 'acc-cash', paymentMethod: 'upi', description: 'Metro card', date: at(month, 7, 8) }),
    txn({ id: 'demo-shopping', type: 'expense', amount: 1250, categoryId: 'cat-shopping', accountId: 'demo-acc-hdfc', paymentMethod: 'credit_card', description: 'Shopping', date: at(month, 9, 16) }),
    txn({ id: 'demo-bills', type: 'expense', amount: 999, categoryId: 'cat-bills', accountId: 'demo-acc-hdfc', paymentMethod: 'upi', description: 'Internet', date: at(month, 6, 10) }),
    txn({ id: 'demo-mobile', type: 'expense', amount: 399, categoryId: 'cat-bills', accountId: 'demo-acc-hdfc', paymentMethod: 'upi', description: 'Mobile recharge', date: at(month, 8, 10) }),
    txn({ id: 'demo-health', type: 'expense', amount: 600, categoryId: 'cat-health', accountId: 'acc-cash', paymentMethod: 'upi', description: 'Pharmacy', date: at(month, 11, 12) }),
    txn({ id: 'demo-transfer', type: 'transfer', amount: 5000, categoryId: '', accountId: 'demo-acc-hdfc', toAccountId: 'demo-acc-savings', paymentMethod: 'bank', description: 'Move to savings', date: at(month, 3, 18) }),
  ];

  const budgets: Budget[] = [
    {
      id: 'demo-budget-month',
      name: 'Monthly budget',
      kind: 'monthly',
      categoryId: '',
      amount: 30000,
      month,
      startDate: '',
      endDate: '',
      createdAt: stamp,
      updatedAt: stamp,
    },
  ];

  const goals: SavingsGoal[] = [
    {
      id: 'demo-goal-emergency',
      name: 'Emergency Fund',
      targetAmount: 150000,
      currentAmount: 42000,
      targetDate: toISODate(new Date(today.getFullYear() + 1, today.getMonth(), 1)),
      icon: 'shield',
      color: '#0f7a5a',
      contributions: [{ id: 'demo-contrib-1', amount: 42000, date: at(previous, 28), note: 'Opening savings' }],
      createdAt: stamp,
      updatedAt: stamp,
    },
    {
      id: 'demo-goal-travel',
      name: 'Travel',
      targetAmount: 80000,
      currentAmount: 15000,
      targetDate: toISODate(new Date(today.getFullYear(), today.getMonth() + 8, 1)),
      icon: 'plane',
      color: '#1d4e89',
      contributions: [{ id: 'demo-contrib-2', amount: 15000, date: at(month, 2), note: '' }],
      createdAt: stamp,
      updatedAt: stamp,
    },
  ];

  const nextMonth = shiftMonth(month, 1);
  const recurring: RecurringRule[] = [
    rule('demo-rec-rent', 'Rent', 12000, 'cat-rent', `${nextMonth}-01`),
    rule('demo-rec-internet', 'Internet', 999, 'cat-bills', toISODate(new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1))),
    rule('demo-rec-gym', 'Gym', 1500, 'cat-fitness', `${nextMonth}-05`),
    rule('demo-rec-mobile', 'Mobile recharge', 399, 'cat-bills', `${nextMonth}-08`),
  ];

  return {
    ...state,
    accounts,
    categories,
    transactions: [...state.transactions.filter((item) => !drop(item.id)), ...transactions],
    budgets: [...state.budgets.filter((item) => !drop(item.id)), ...budgets],
    goals: [...state.goals.filter((item) => !drop(item.id)), ...goals],
    recurring: [...state.recurring.filter((item) => !drop(item.id)), ...recurring],
    settings: {
      ...state.settings,
      lastCategoryId: 'cat-food',
      lastPaymentMethod: 'upi',
      lastAccountId: 'demo-acc-hdfc',
      recentCategoryIds: ['cat-food', 'cat-transport', 'cat-shopping'],
      recentPaymentMethods: ['upi', 'bank', 'cash'],
      updatedAt: stamp,
    },
  };
}

function rule(id: string, description: string, amount: number, categoryId: string, nextDate: string): RecurringRule {
  const stamp = nowIso();
  return {
    id,
    type: 'expense',
    amount,
    categoryId,
    accountId: 'demo-acc-hdfc',
    toAccountId: '',
    paymentMethod: 'bank',
    description,
    notes: '',
    frequency: 'monthly',
    nextDate,
    anchorDay: Number(nextDate.slice(8, 10)),
    reminderDays: 2,
    active: true,
    createdAt: stamp,
    updatedAt: stamp,
  };
}

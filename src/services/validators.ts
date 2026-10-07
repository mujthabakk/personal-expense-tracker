import type { PersistedState, Transaction } from '@/models/types';
import { roundMoney } from '@/lib/money';

export function validateTransaction(
  input: Pick<Transaction, 'type' | 'amount' | 'categoryId' | 'accountId' | 'toAccountId' | 'description' | 'notes' | 'date'>,
  state: Pick<PersistedState, 'categories' | 'accounts'>,
): string | null {
  if (!Number.isFinite(input.amount) || input.amount <= 0) return 'Enter an amount greater than zero.';
  if (input.amount > 100_000_000) return 'Amount is too large.';
  if (!input.date || Number.isNaN(new Date(input.date).getTime())) return 'Choose a valid date.';
  if (input.description.length > 140) return 'Description must be 140 characters or less.';
  if (input.notes.length > 2000) return 'Notes must be 2000 characters or less.';
  const account = state.accounts.find((item) => item.id === input.accountId);
  if (!account) return 'Choose an account.';
  if (input.type === 'transfer') {
    const destination = state.accounts.find((item) => item.id === input.toAccountId);
    if (!destination) return 'Choose a destination account.';
    if (destination.id === account.id) return 'Choose two different accounts.';
    return null;
  }
  const category = state.categories.find((item) => item.id === input.categoryId);
  if (!category || category.type !== input.type) return 'Choose a category.';
  return null;
}

export function validateCategory(name: string, budgetAmount: number): string | null {
  const trimmed = name.trim();
  if (!trimmed) return 'Enter a category name.';
  if (trimmed.length > 40) return 'Category name must be 40 characters or less.';
  if (budgetAmount < 0) return 'Budget cannot be negative.';
  return null;
}

export function validateAccount(name: string, openingBalance: number): string | null {
  if (!name.trim()) return 'Enter an account name.';
  if (name.trim().length > 40) return 'Account name must be 40 characters or less.';
  if (!Number.isFinite(openingBalance)) return 'Enter a valid opening balance.';
  return null;
}

export function validateBudget(amount: number, startDate = '', endDate = ''): string | null {
  if (!Number.isFinite(amount) || amount <= 0) return 'Enter a budget amount.';
  if (startDate && endDate && endDate < startDate) return 'End date must be on or after the start date.';
  return null;
}

export function validateGoal(name: string, target: number, current: number): string | null {
  if (!name.trim()) return 'Enter a goal name.';
  if (!Number.isFinite(target) || target <= 0) return 'Enter a target amount.';
  if (!Number.isFinite(current) || current < 0) return 'Saved amount cannot be negative.';
  return null;
}

export function normalizeAmount(amount: number): number {
  return roundMoney(amount);
}

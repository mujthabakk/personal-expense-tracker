import { describe, expect, it } from 'vitest';
import { defaultCategories } from '@/data/defaults';
import type { Transaction } from '@/models/types';
import { buildSpendAlerts, investmentAmount } from '@/services/spendAlerts';

function expense(partial: Partial<Transaction> & Pick<Transaction, 'id' | 'amount' | 'categoryId'>): Transaction {
  return {
    type: 'expense',
    accountId: 'acc-cash',
    toAccountId: '',
    paymentMethod: 'upi',
    description: partial.description ?? 'Item',
    notes: '',
    date: '2026-10-08T10:00:00.000Z',
    createdAt: '2026-10-08T10:00:00.000Z',
    updatedAt: '2026-10-08T10:00:00.000Z',
    recurringTransactionId: '',
    ...partial,
  };
}

describe('spend alerts', () => {
  const categories = defaultCategories();

  it('shows investment and flags shopping as unwanted', () => {
    const transactions = [
      expense({ id: 'inv', amount: 5000, categoryId: 'cat-investment', description: 'Index fund' }),
      expense({ id: 'shop', amount: 2400, categoryId: 'cat-shopping', description: 'Shoes' }),
    ];
    expect(investmentAmount(transactions, categories, '2026-10')).toBe(5000);
    const alerts = buildSpendAlerts(transactions, categories, [], '2026-10');
    expect(alerts.some((alert) => alert.title.includes('Shopping') && alert.items.some((item) => item.label === 'Shoes'))).toBe(true);
  });
});

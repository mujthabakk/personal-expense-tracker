import { describe, expect, it } from 'vitest';
import { defaultCategories } from '@/data/defaults';
import type { Transaction } from '@/models/types';
import { buildIncomeSplit } from '@/services/incomeSplit';

function txn(partial: Partial<Transaction> & Pick<Transaction, 'id' | 'type' | 'amount' | 'categoryId'>): Transaction {
  return {
    accountId: 'acc-bank',
    toAccountId: '',
    paymentMethod: 'bank',
    description: '',
    notes: '',
    date: '2026-10-08T10:00:00.000Z',
    createdAt: '2026-10-08T10:00:00.000Z',
    updatedAt: '2026-10-08T10:00:00.000Z',
    recurringTransactionId: '',
    ...partial,
  };
}

describe('income split', () => {
  it('turns income into round amounts for family and investment', () => {
    const categories = defaultCategories();
    const transactions = [
      txn({ id: 'pay', type: 'income', amount: 35000, categoryId: 'cat-salary' }),
      txn({ id: 'fam', type: 'expense', amount: 25000, categoryId: 'cat-family' }),
      txn({ id: 'inv', type: 'expense', amount: 0, categoryId: 'cat-investment' }),
    ];
    const split = buildIncomeSplit(transactions.filter((item) => item.amount > 0), categories, '2026-10');
    const family = split.buckets.find((bucket) => bucket.id === 'family');
    const investment = split.buckets.find((bucket) => bucket.id === 'investment');
    expect(split.income).toBe(35000);
    expect(family?.planned).toBe(11000);
    expect(family?.spent).toBe(25000);
    expect(investment?.planned).toBe(7000);
    expect(split.buckets.reduce((sum, bucket) => sum + bucket.planned, 0) + split.keep).toBe(35000);
  });
});

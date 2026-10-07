import { describe, expect, it } from 'vitest';
import { defaultAccounts, defaultCategories } from '@/data/defaults';
import type { Transaction } from '@/models/types';
import { buildInvestmentPlan } from '@/services/investmentPlan';

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

describe('investment plan', () => {
  const categories = defaultCategories();
  const accounts = defaultAccounts();

  it('fills an emergency fund before a large SIP when savings are low', () => {
    const transactions = [
      txn({ id: 'in', type: 'income', amount: 50000, categoryId: 'cat-salary' }),
      txn({ id: 'rent', type: 'expense', amount: 15000, categoryId: 'cat-rent' }),
      txn({ id: 'food', type: 'expense', amount: 5000, categoryId: 'cat-groceries' }),
    ];
    const result = buildInvestmentPlan(transactions, categories, accounts, '2026-10');
    expect(result.surplus).toBe(30000);
    expect(result.stage).toBe('emergency');
    expect(result.slices.find((slice) => slice.id === 'emergency')?.monthly).toBe(24000);
    expect(result.slices.find((slice) => slice.id === 'equity')?.monthly).toBe(6000);
  });

  it('invests the surplus once six months of costs are already saved', () => {
    const funded = defaultAccounts().map((account) => account.id === 'acc-bank' ? { ...account, openingBalance: 200000 } : account);
    const transactions = [
      txn({ id: 'in', type: 'income', amount: 50000, categoryId: 'cat-salary' }),
      txn({ id: 'rent', type: 'expense', amount: 20000, categoryId: 'cat-rent' }),
    ];
    const result = buildInvestmentPlan(transactions, categories, funded, '2026-10');
    expect(result.stage).toBe('investing');
    expect(result.slices.find((slice) => slice.id === 'equity')?.monthly).toBe(21000);
    expect(result.slices.find((slice) => slice.id === 'debt')?.monthly).toBe(6000);
    expect(result.slices.find((slice) => slice.id === 'gold')?.monthly).toBe(3000);
  });
});

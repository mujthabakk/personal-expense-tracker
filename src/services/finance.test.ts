import { describe, expect, it } from 'vitest';
import { createInitialState } from '@/data/defaults';
import { advanceDate } from '@/services/recurring';
import { computeAccountBalance, netWorth, spendingByCategory, summarizeMonth, totalsFor } from '@/services/finance';
import { mergeCollection } from '@/services/syncMerge';
import { parseCsv, toCsv } from '@/services/exportData';
import { decryptJson, derivePinKey, encryptJson, randomBytes } from '@/lib/crypto';
import type { Account, Transaction } from '@/models/types';

function account(partial: Partial<Account> & Pick<Account, 'id' | 'type'>): Account {
  return {
    name: partial.id,
    openingBalance: 0,
    institution: '',
    color: '#111',
    icon: 'cash',
    isDefault: false,
    createdAt: '1970-01-01T00:00:00.000Z',
    updatedAt: '1970-01-01T00:00:00.000Z',
    ...partial,
  };
}

function txn(partial: Partial<Transaction> & Pick<Transaction, 'id' | 'type' | 'amount' | 'accountId'>): Transaction {
  return {
    categoryId: 'cat-food',
    toAccountId: '',
    paymentMethod: 'cash',
    description: '',
    notes: '',
    date: '2026-10-05T10:00:00.000Z',
    createdAt: '2026-10-05T10:00:00.000Z',
    updatedAt: '2026-10-05T10:00:00.000Z',
    recurringTransactionId: '',
    ...partial,
  };
}

describe('balances', () => {
  it('keeps transfers neutral for net worth and tracks a credit card payment', () => {
    const cash = account({ id: 'cash', type: 'cash', openingBalance: 1000 });
    const bank = account({ id: 'bank', type: 'bank', openingBalance: 500 });
    const card = account({ id: 'card', type: 'credit_card', openingBalance: 0 });
    const transactions = [
      txn({ id: '1', type: 'expense', amount: 200, accountId: 'cash' }),
      txn({ id: '2', type: 'income', amount: 500, accountId: 'bank', categoryId: 'cat-salary' }),
      txn({ id: '3', type: 'transfer', amount: 300, accountId: 'cash', toAccountId: 'bank' }),
      txn({ id: '4', type: 'expense', amount: 500, accountId: 'card' }),
      txn({ id: '5', type: 'transfer', amount: 200, accountId: 'bank', toAccountId: 'card' }),
    ];
    expect(computeAccountBalance(cash, transactions)).toBe(500);
    expect(computeAccountBalance(bank, transactions)).toBe(1100);
    expect(computeAccountBalance(card, transactions)).toBe(300);
    const beforeCard = netWorth([cash, bank], transactions.filter((item) => item.accountId !== 'card' && item.toAccountId !== 'card'));
    expect(netWorth([cash, bank, card], transactions)).toBe(beforeCard - 500);
  });

  it('excludes transfers from income and expenses', () => {
    const totals = totalsFor([
      txn({ id: '1', type: 'income', amount: 35000, accountId: 'bank', categoryId: 'cat-salary', date: '2026-10-01T00:00:00.000Z' }),
      txn({ id: '2', type: 'expense', amount: 18250, accountId: 'cash', date: '2026-10-02T00:00:00.000Z' }),
      txn({ id: '3', type: 'transfer', amount: 5000, accountId: 'bank', toAccountId: 'cash', date: '2026-10-03T00:00:00.000Z' }),
    ], '2026-10');
    expect(totals).toMatchObject({ income: 35000, expense: 18250, savings: 16750 });
    expect(totals.savingsRate).toBeCloseTo(47.857, 2);
  });
});

describe('categories and dates', () => {
  it('returns amount and percentage for spending', () => {
    const state = createInitialState();
    const rows = spendingByCategory([
      txn({ id: '1', type: 'expense', amount: 75, accountId: 'acc-cash', categoryId: 'cat-food' }),
      txn({ id: '2', type: 'expense', amount: 25, accountId: 'acc-cash', categoryId: 'cat-transport' }),
    ], state.categories, '2026-10');
    expect(rows[0]).toMatchObject({ name: 'Food', percent: 75 });
    expect(rows[1].percent).toBe(25);
  });

  it('clamps month-end recurring dates', () => {
    expect(advanceDate('2026-01-31', 'monthly', 31)).toBe('2026-02-28');
    expect(advanceDate('2026-02-28', 'monthly', 31)).toBe('2026-03-31');
  });

  it('compares a month with the previous one', () => {
    const state = createInitialState();
    const summary = summarizeMonth([
      txn({ id: '1', type: 'income', amount: 100, accountId: 'a', categoryId: 'cat-salary', date: '2026-09-01T00:00:00.000Z' }),
      txn({ id: '2', type: 'income', amount: 105, accountId: 'a', categoryId: 'cat-salary', date: '2026-10-01T00:00:00.000Z' }),
      txn({ id: '3', type: 'expense', amount: 80, accountId: 'a', date: '2026-09-02T00:00:00.000Z' }),
      txn({ id: '4', type: 'expense', amount: 40, accountId: 'a', date: '2026-10-02T00:00:00.000Z' }),
    ], state.categories, '2026-10');
    expect(summary.incomeChange).toBe('+5%');
    expect(summary.expenseChange).toBe('-50%');
    expect(summary.topCategory).toBe('Food');
  });
});

describe('sync and files', () => {
  it('lets the newer record win and honors tombstones', () => {
    const merged = mergeCollection(
      'transactions',
      [{ id: 'a', updatedAt: '2026-02-01T00:00:00.000Z', amount: 2 }],
      [{ id: 'a', updatedAt: '2026-01-01T00:00:00.000Z', amount: 1 }, { id: 'b', updatedAt: '2026-01-02T00:00:00.000Z', amount: 9 }],
      [{ id: 'transactions:b', collection: 'transactions', entityId: 'b', deletedAt: '2026-03-01T00:00:00.000Z' }],
    );
    expect(merged.next).toEqual([{ id: 'a', updatedAt: '2026-02-01T00:00:00.000Z', amount: 2 }]);
    expect(merged.upload.map((item) => item.id)).toEqual(['a']);
    expect(merged.deleteRemote).toEqual(['b']);
  });

  it('round-trips csv cells and an encrypted payload', async () => {
    const state = createInitialState();
    const csv = toCsv([txn({ id: '1', type: 'expense', amount: 10, accountId: 'acc-cash', description: 'Say "hi", please' })], state);
    const rows = parseCsv(csv);
    expect(rows[1][6]).toBe('Say "hi", please');
    const key = await derivePinKey('2468', randomBytes(16), 1000);
    const encrypted = await encryptJson(key, { secret: 42 });
    await expect(decryptJson(key, encrypted.iv, encrypted.ciphertext)).resolves.toEqual({ secret: 42 });
  });
});

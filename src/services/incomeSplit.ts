import { roundMoney } from '@/lib/money';
import type { Category, Transaction } from '@/models/types';
import { isInMonth, totalsFor } from '@/services/finance';

const BUCKETS = [
  { id: 'family', name: 'Family', share: 0.3, words: ['family'] },
  { id: 'investment', name: 'Investment', share: 0.2, words: ['invest'] },
  { id: 'food', name: 'Food', share: 0.15, words: ['food', 'grocery', 'chicken', 'vegetable'] },
  { id: 'bills', name: 'Bills and fuel', share: 0.15, words: ['bill', 'fuel', 'transport', 'recharge', 'rent', 'depot'] },
  { id: 'personal', name: 'Personal', share: 0.1, words: ['personal', 'shop', 'entertain', 'fitness', 'subscription'] },
] as const;

export interface IncomeBucket {
  id: string;
  name: string;
  planned: number;
  spent: number;
}

export interface IncomeSplit {
  income: number;
  buckets: IncomeBucket[];
  keep: number;
  otherSpent: number;
}

export function buildIncomeSplit(transactions: Transaction[], categories: Category[], month: string): IncomeSplit {
  const income = totalsFor(transactions, month).income;
  const step = income >= 20000 ? 1000 : income >= 2000 ? 100 : 10;
  const buckets: IncomeBucket[] = BUCKETS.map((bucket) => ({
    id: bucket.id,
    name: bucket.name,
    planned: income > 0 ? Math.round((income * bucket.share) / step) * step : 0,
    spent: 0,
  }));

  let plannedTotal = buckets.reduce((sum, bucket) => sum + bucket.planned, 0);
  while (plannedTotal > income && income > 0) {
    const largest = buckets.reduce((best, bucket) => (bucket.planned > best.planned ? bucket : best));
    const cut = Math.min(step, plannedTotal - income, largest.planned);
    if (cut <= 0) break;
    largest.planned = roundMoney(largest.planned - cut);
    plannedTotal = roundMoney(plannedTotal - cut);
  }

  let otherSpent = 0;
  for (const transaction of transactions) {
    if (transaction.type !== 'expense' || !isInMonth(transaction.date, month)) continue;
    const name = (categories.find((category) => category.id === transaction.categoryId)?.name ?? '').toLowerCase();
    const rule = BUCKETS.find((entry) => entry.words.some((word) => name.includes(word)));
    const bucket = buckets.find((item) => item.id === rule?.id);
    if (bucket) bucket.spent = roundMoney(bucket.spent + transaction.amount);
    else otherSpent = roundMoney(otherSpent + transaction.amount);
  }

  return {
    income,
    buckets,
    keep: roundMoney(Math.max(0, income - plannedTotal)),
    otherSpent,
  };
}

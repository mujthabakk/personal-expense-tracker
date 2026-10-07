import { monthKey, shiftMonth } from '@/lib/dates';
import { formatMoney } from '@/lib/money';
import type { PersistedState } from '@/models/types';
import { resolvedBudgets, spendingByCategory, totalsFor } from '@/services/finance';

export interface Insight {
  id: string;
  tone: 'neutral' | 'good' | 'bad' | 'warning';
  key: string;
  vars: Record<string, string | number>;
}

export function buildInsights(state: Pick<PersistedState, 'transactions' | 'categories' | 'budgets' | 'settings'>, today = new Date()): Insight[] {
  const month = monthKey(today);
  const previous = shiftMonth(month, -1);
  const insights: Insight[] = [];
  const currentSpend = spendingByCategory(state.transactions, state.categories, month);
  const previousSpend = spendingByCategory(state.transactions, state.categories, previous);
  const currency = state.settings.currency;
  const language = state.settings.language;

  if (currentSpend[0]) {
    insights.push({
      id: 'top-category',
      tone: 'neutral',
      key: 'Your highest spending category is {name}.',
      vars: { name: currentSpend[0].name },
    });
  }

  const changes = currentSpend
    .map((item) => {
      const before = previousSpend.find((entry) => entry.categoryId === item.categoryId)?.amount ?? 0;
      if (before < 100 && item.amount < 100) return null;
      if (before === 0) return null;
      const pct = Math.round(((item.amount - before) / before) * 100);
      return { ...item, pct, before };
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item));

  const increase = [...changes].filter((item) => item.pct >= 5).sort((a, b) => b.pct - a.pct)[0];
  const decrease = [...changes].filter((item) => item.pct <= -5).sort((a, b) => a.pct - b.pct)[0];
  if (increase) {
    insights.push({
      id: `up-${increase.categoryId}`,
      tone: 'bad',
      key: 'You spent {pct}% more on {name} this month.',
      vars: { pct: increase.pct, name: increase.name },
    });
  }
  if (decrease) {
    insights.push({
      id: `down-${decrease.categoryId}`,
      tone: 'good',
      key: '{name} expenses decreased by {pct}% compared with last month.',
      vars: { name: decrease.name, pct: Math.abs(decrease.pct) },
    });
  }

  const totals = totalsFor(state.transactions, month);
  if (totals.savings > 0) {
    insights.push({
      id: 'saved',
      tone: 'good',
      key: 'You saved {amount} this month.',
      vars: { amount: formatMoney(totals.savings, currency, language) },
    });
  } else if (totals.expense > totals.income && totals.expense > 0) {
    insights.push({
      id: 'overspent',
      tone: 'warning',
      key: 'Expenses are {amount} higher than income this month.',
      vars: { amount: formatMoney(totals.expense - totals.income, currency, language) },
    });
  }

  const exceeded = resolvedBudgets(state, month).filter((row) => row.status === 'exceeded');
  if (exceeded[0]) {
    insights.push({
      id: `budget-${exceeded[0].id}`,
      tone: 'warning',
      key: '{name} is over budget.',
      vars: { name: exceeded[0].name },
    });
  }

  return insights.slice(0, 5);
}

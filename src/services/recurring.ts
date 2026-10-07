import { combineDate, localDay, toISODate } from '@/lib/dates';
import { makeId, nowIso } from '@/lib/id';
import type { Frequency, PersistedState, RecurringRule, Transaction } from '@/models/types';

export function advanceDate(isoDate: string, frequency: Frequency, anchorDay: number): string {
  const [year, month, day] = isoDate.split('-').map(Number);
  if (frequency === 'daily') return toISODate(new Date(year, month - 1, day + 1));
  if (frequency === 'weekly') return toISODate(new Date(year, month - 1, day + 7));

  const monthsAhead = frequency === 'yearly' ? 12 : 1;
  const cursor = new Date(year, month - 1 + monthsAhead, 1);
  const last = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
  cursor.setDate(Math.min(anchorDay || day, last));
  return toISODate(cursor);
}

function transactionFromRule(rule: RecurringRule, date: string): Transaction {
  const stamp = nowIso();
  return {
    id: makeId(),
    type: rule.type,
    amount: rule.amount,
    categoryId: rule.categoryId,
    accountId: rule.accountId,
    toAccountId: rule.toAccountId,
    paymentMethod: rule.paymentMethod,
    description: rule.description,
    notes: rule.notes,
    date: combineDate(date, new Date(`${date}T09:00:00`)),
    createdAt: stamp,
    updatedAt: stamp,
    recurringTransactionId: rule.id,
  };
}

export function materializeRecurring(state: PersistedState, today = new Date()): PersistedState {
  const todayKey = toISODate(today);
  let changed = false;
  const transactions = [...state.transactions];
  const recurring = state.recurring.map((rule) => ({ ...rule }));

  for (const rule of recurring) {
    if (!rule.active) continue;
    let guard = 0;
    while (rule.nextDate <= todayKey && guard < 36) {
      const exists = transactions.some(
        (transaction) => transaction.recurringTransactionId === rule.id && localDay(transaction.date) === rule.nextDate,
      );
      if (!exists) transactions.push(transactionFromRule(rule, rule.nextDate));
      rule.nextDate = advanceDate(rule.nextDate, rule.frequency, rule.anchorDay);
      rule.updatedAt = nowIso();
      changed = true;
      guard += 1;
    }
  }

  if (!changed) return state;
  return { ...state, transactions, recurring };
}

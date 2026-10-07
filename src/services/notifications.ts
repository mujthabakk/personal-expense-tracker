import { monthKey, shiftMonth } from '@/lib/dates';
import { formatMoney, formatPercent } from '@/lib/money';
import { nowIso } from '@/lib/id';
import type { AppNotification, PersistedState } from '@/models/types';
import { goalMonthlyNeed, reminderLabel, resolvedBudgets, summarizeMonth } from '@/services/finance';

function keep(previous: AppNotification[], draft: Omit<AppNotification, 'read' | 'createdAt' | 'updatedAt'>): AppNotification {
  const existing = previous.find((item) => item.id === draft.id);
  if (
    existing &&
    existing.titleKey === draft.titleKey &&
    existing.messageKey === draft.messageKey &&
    JSON.stringify(existing.vars) === JSON.stringify(draft.vars)
  ) {
    return existing;
  }
  const stamp = nowIso();
  return {
    ...draft,
    read: existing?.read ?? false,
    createdAt: existing?.createdAt ?? stamp,
    updatedAt: stamp,
  };
}

export function buildNotifications(state: PersistedState, previous = state.notifications, today = new Date()): AppNotification[] {
  const month = monthKey(today);
  const currency = state.settings.currency;
  const language = state.settings.language;
  const prefs = state.settings.notifications;
  const drafts: Array<Omit<AppNotification, 'read' | 'createdAt' | 'updatedAt'>> = [];

  if (prefs.budgetWarning || prefs.budgetExceeded) {
    for (const row of resolvedBudgets(state, month)) {
      if (row.status === 'exceeded' && prefs.budgetExceeded) {
        drafts.push({
          id: `budget-exceeded:${month}:${row.id}`,
          type: 'budget_exceeded',
          titleKey: 'Budget exceeded',
          messageKey: '{name} is over its {amount} budget. Spent {spent}.',
          vars: {
            name: row.name,
            amount: formatMoney(row.limit, currency, language),
            spent: formatMoney(row.spent, currency, language),
          },
          href: '/budgets',
        });
      } else if (row.status === 'warning' && prefs.budgetWarning) {
        drafts.push({
          id: `budget-warning:${month}:${row.id}`,
          type: 'budget_warning',
          titleKey: 'Budget almost exceeded',
          messageKey: '{name} is at {pct}% of its budget.',
          vars: { name: row.name, pct: Math.round(row.percent) },
          href: '/budgets',
        });
      }
    }
  }

  if (prefs.recurring) {
    for (const rule of state.recurring) {
      if (!rule.active) continue;
      const reminder = reminderLabel(rule.nextDate, today);
      if (reminder.days < 0 || reminder.days > rule.reminderDays) continue;
      const when = reminder.days === 0 ? 'today' : reminder.days === 1 ? 'tomorrow' : `in ${reminder.days} days`;
      drafts.push({
        id: `recurring:${rule.id}:${rule.nextDate}`,
        type: 'recurring',
        titleKey: 'Payment coming up',
        messageKey: '{name} · {amount} is due {when}.',
        vars: {
          name: rule.description || 'Recurring payment',
          amount: formatMoney(rule.amount, currency, language),
          when,
        },
        href: '/recurring',
      });
    }
  }

  if (prefs.goals) {
    for (const goal of state.goals) {
      const needed = goalMonthlyNeed(goal, today);
      if (needed <= 0) continue;
      drafts.push({
        id: `goal:${goal.id}:${month}`,
        type: 'goal',
        titleKey: 'Savings goal reminder',
        messageKey: 'Add about {amount} this month to stay on track for {name}.',
        vars: { amount: formatMoney(needed, currency, language), name: goal.name },
        href: '/goals',
      });
    }
  }

  const previousMonth = shiftMonth(month, -1);
  if (prefs.monthlySummary) {
    const summary = summarizeMonth(state.transactions, state.categories, previousMonth);
    if (summary.income > 0 || summary.expense > 0) {
      drafts.push({
        id: `summary:${previousMonth}`,
        type: 'monthly_summary',
        titleKey: 'Monthly summary',
        messageKey: 'Income {income}, expenses {expenses}, savings {savings} ({rate}).',
        vars: {
          income: formatMoney(summary.income, currency, language),
          expenses: formatMoney(summary.expense, currency, language),
          savings: formatMoney(summary.savings, currency, language),
          rate: formatPercent(summary.savingsRate, 1),
        },
        href: '/reports',
      });
    }
  }

  const next = drafts.map((draft) => keep(previous, draft));
  if (next.length === 0 && previous.length === 0) return previous;
  return next;
}

export function unreadCount(notifications: AppNotification[]): number {
  return notifications.filter((item) => !item.read).length;
}

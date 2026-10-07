import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { IncomeExpenseChart } from '@/components/Charts';
import { Icon } from '@/components/Icon';
import { EmptyState, Progress } from '@/components/ui';
import { useI18n } from '@/i18n';
import { formatMonth, monthKey, shiftMonth } from '@/lib/dates';
import { chartColor } from '@/lib/color';
import { formatMoney, formatPercent, formatSigned } from '@/lib/money';
import { QUICK_EXPENSES } from '@/models/types';
import { chartSeries, netWorth, reminderLabel, resolvedBudgets, spendingByCategory, summarizeMonth, transactionTitle, goalProgress } from '@/services/finance';
import { useLedger } from '@/store/ledger';

export function HomePage() {
  const tr = useI18n();
  const [month, setMonth] = useState(() => monthKey(new Date()));
  const transactions = useLedger((state) => state.transactions);
  const categories = useLedger((state) => state.categories);
  const accounts = useLedger((state) => state.accounts);
  const budgets = useLedger((state) => state.budgets);
  const goals = useLedger((state) => state.goals);
  const recurring = useLedger((state) => state.recurring);
  const settings = useLedger((state) => state.settings);
  const profile = useLedger((state) => state.userProfile);
  const quickAdd = useLedger((state) => state.quickAdd);
  const currency = settings.currency;
  const language = settings.language;

  const summary = useMemo(() => summarizeMonth(transactions, categories, month), [transactions, categories, month]);
  const balance = useMemo(() => netWorth(accounts, transactions), [accounts, transactions]);
  const spend = useMemo(() => spendingByCategory(transactions, categories, month), [transactions, categories, month]);
  const budgetRows = useMemo(() => resolvedBudgets({ budgets, categories, transactions }, month), [budgets, categories, transactions, month]);
  const monthlyBudget = budgetRows.find((row) => row.kind === 'monthly');
  const recent = useMemo(
    () => [...transactions].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8),
    [transactions],
  );
  const weeks = useMemo(() => {
    const [year, monthIndex] = month.split('-').map(Number);
    const last = new Date(year, monthIndex, 0).getDate();
    const starts = [1, 8, 15, 22];
    const buckets = starts.map((start, index) => {
      const end = index === starts.length - 1 ? last : (starts[index + 1] ?? last + 1) - 1;
      const startKey = `${month}-${String(start).padStart(2, '0')}`;
      const endKey = `${month}-${String(Math.min(end, last)).padStart(2, '0')}`;
      return { key: startKey, label: `${start}–${Math.min(end, last)}`, start: startKey, end: endKey };
    });
    return chartSeries(transactions, buckets);
  }, [transactions, month]);
  const upcoming = recurring.filter((rule) => rule.active).slice(0, 3);

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{profile.name ? `Hello, ${profile.name}` : 'Hello'}</h1>
          <p className="muted text-sm">{formatMonth(month, language)}</p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" className="icon-btn border border-[var(--line)]" aria-label="Previous month" onClick={() => setMonth(shiftMonth(month, -1))}><ChevronLeft size={18} /></button>
          <button type="button" className="icon-btn border border-[var(--line)]" aria-label="Next month" onClick={() => setMonth(shiftMonth(month, 1))}><ChevronRight size={18} /></button>
        </div>
      </div>

      <div className="flex gap-2 overflow-auto">
        {QUICK_EXPENSES.map((item) => (
          <button key={item.categoryId} type="button" className="chip" onClick={() => quickAdd(item.amount, item.categoryId)}>
            + {formatMoney(item.amount, currency, language)} {item.label}
          </button>
        ))}
      </div>

      <section className="balance-card">
        <div className="metric-label">{tr('Total balance')}</div>
        <div className="display mt-2 text-5xl">{formatMoney(balance, currency, language)}</div>
        <p className="mt-2 text-sm text-white/60">All accounts</p>
        <div className="mt-6 grid grid-cols-3 gap-3 border-t border-white/10 pt-4">
          <Metric label={tr('Income')} value={formatMoney(summary.income, currency, language)} tone="income" />
          <Metric label={tr('Expenses')} value={formatMoney(summary.expense, currency, language)} tone="expense" />
          <Metric label={tr('Savings')} value={formatMoney(summary.savings, currency, language)} />
        </div>
        <p className="mt-3 text-xs text-white/50">{tr('This month')}</p>
      </section>

      {transactions.length === 0 ? (
        <section className="card">
          <EmptyState
            title={tr('No transactions yet.')}
            body={tr('Start tracking your spending by adding your first expense.')}
            action={<Link to="/transactions/new" className="btn btn-primary">Add expense</Link>}
          />
        </section>
      ) : (
        <div className="grid gap-4 lg:grid-cols-12">
          <section className="card p-5 lg:col-span-5">
            <h2 className="font-semibold">{tr('Monthly overview')}</h2>
            <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div>
                <div className="muted">{tr('Remaining budget')}</div>
                <div className="amount mt-1 text-xl font-semibold">{monthlyBudget ? formatMoney(monthlyBudget.limit - monthlyBudget.spent, currency, language) : '—'}</div>
              </div>
              <div>
                <div className="muted">{tr('Savings rate')}</div>
                <div className="amount mt-1 text-xl font-semibold">{formatPercent(summary.savingsRate, 1)}</div>
              </div>
            </div>
            <div className="mt-4">
              <IncomeExpenseChart data={weeks} currency={currency} language={language} />
              <div className="mt-2 flex gap-4 text-xs text-[var(--muted)]">
                <span className="inline-flex items-center gap-1"><i className="inline-block h-2 w-2 rounded-full bg-[#2fbf8f]" /> Income</span>
                <span className="inline-flex items-center gap-1"><i className="inline-block h-2 w-2 rounded-full bg-[#e08a4f]" /> Expenses</span>
              </div>
            </div>
          </section>

          <section className="card p-5 lg:col-span-7">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-semibold">{tr('Spending categories')}</h2>
            </div>
            {spend.length === 0 ? <p className="muted text-sm">No expenses this month.</p> : (
              <div className="grid gap-3">
                {spend.slice(0, 6).map((item) => (
                  <div key={item.categoryId}>
                    <div className="mb-1 flex items-center justify-between text-sm">
                      <span className="inline-flex items-center gap-2 font-medium"><Icon name={item.icon} size={16} /> {item.name}</span>
                      <span className="amount">{formatMoney(item.amount, currency, language)} · {formatPercent(item.percent, 0)}</span>
                    </div>
                    <Progress value={item.percent} status="ok" />
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="card p-5 lg:col-span-7">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="font-semibold">{tr('Recent transactions')}</h2>
              <Link to="/transactions" className="text-sm font-semibold">{tr('View all')}</Link>
            </div>
            <div>
              {recent.map((transaction) => {
                const category = categories.find((item) => item.id === transaction.categoryId);
                return (
                  <Link key={transaction.id} to={`/transactions/${transaction.id}/edit`} className="row-btn">
                    <span className="grid h-10 w-10 place-items-center rounded-xl" style={{ background: `${chartColor(category?.color ?? '#5b7c99')}22`, color: chartColor(category?.color ?? '#5b7c99') }}>
                      <Icon name={transaction.type === 'transfer' ? 'transfer' : category?.icon ?? 'circle'} />
                    </span>
                    <span>
                      <span className="block font-semibold">{transactionTitle(transaction, categories)}</span>
                      <span className="muted block text-xs">{category?.name ?? tr('Transfer')} · {transaction.paymentMethod.replaceAll('_', ' ')}</span>
                    </span>
                    <span className={transaction.type === 'expense' ? 'amount font-semibold text-[var(--expense)]' : transaction.type === 'income' ? 'amount font-semibold text-[var(--income)]' : 'amount font-semibold'}>
                      {formatSigned(transaction.type, transaction.amount, currency, language)}
                    </span>
                  </Link>
                );
              })}
            </div>
          </section>

          <section className="grid gap-4 lg:col-span-5">
            <div className="card p-5">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="font-semibold">Savings goals</h2>
                <Link to="/goals" className="text-sm font-semibold">{tr('View all')}</Link>
              </div>
              {goals.length === 0 ? <p className="muted text-sm">{tr('No savings goals.')}</p> : goals.slice(0, 2).map((goal) => (
                <div key={goal.id} className="mb-3">
                  <div className="flex justify-between text-sm font-medium"><span>{goal.name}</span><span>{formatPercent(goalProgress(goal), 0)}</span></div>
                  <Progress value={goalProgress(goal)} status="ok" />
                </div>
              ))}
            </div>
            <div className="card p-5">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="font-semibold">Upcoming</h2>
                <Link to="/recurring" className="text-sm font-semibold">{tr('View all')}</Link>
              </div>
              {upcoming.length === 0 ? <p className="muted text-sm">No recurring payments.</p> : upcoming.map((rule) => {
                const reminder = reminderLabel(rule.nextDate);
                return (
                  <div key={rule.id} className="flex items-center justify-between py-2 text-sm">
                    <span>{rule.description}</span>
                    <span className="muted">{reminder.days === 0 ? 'Today' : `${rule.nextDate.slice(8)} · ${formatMoney(rule.amount, currency, language)}`}</span>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: 'income' | 'expense' }) {
  return (
    <div className={tone}>
      <div className="metric-label">{label}</div>
      <div className="amount mt-1 text-lg font-semibold">{value}</div>
    </div>
  );
}

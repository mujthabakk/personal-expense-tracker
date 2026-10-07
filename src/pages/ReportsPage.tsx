import { useMemo, useState } from 'react';
import { DonutChart, IncomeExpenseChart, SavingsLine } from '@/components/Charts';
import { IncomeSplit } from '@/components/IncomeSplit';
import { SpendReview } from '@/components/SpendReview';
import { PageIntro, Progress, Segmented } from '@/components/ui';
import { useI18n } from '@/i18n';
import { formatMonth, monthKey } from '@/lib/dates';
import { formatMoney, formatPercent } from '@/lib/money';
import { buildInsights } from '@/services/insights';
import { chartSeries, reportBuckets, resolvedBudgets, spendingByCategory, summarizeMonth, totalsFor, transactionsInRange } from '@/services/finance';
import { useLedger } from '@/store/ledger';

export function ReportsPage() {
  const tr = useI18n();
  const [period, setPeriod] = useState<'daily' | 'weekly' | 'monthly' | 'yearly'>('monthly');
  const currentMonth = monthKey(new Date());
  const [month, setMonth] = useState(currentMonth);
  const transactions = useLedger((state) => state.transactions);
  const categories = useLedger((state) => state.categories);
  const budgets = useLedger((state) => state.budgets);
  const settings = useLedger((state) => state.settings);
  const buckets = useMemo(() => reportBuckets(period), [period]);
  const rangeTransactions = useMemo(
    () => transactionsInRange(transactions, buckets[0]?.start ?? '', buckets[buckets.length - 1]?.end ?? ''),
    [transactions, buckets],
  );
  const series = useMemo(() => chartSeries(transactions, buckets), [transactions, buckets]);
  const spend = useMemo(() => spendingByCategory(rangeTransactions, categories), [rangeTransactions, categories]);
  const insights = useMemo(() => buildInsights({ transactions, categories, budgets, settings }), [transactions, categories, budgets, settings]);
  const summary = useMemo(() => summarizeMonth(transactions, categories, month), [transactions, categories, month]);
  const utilization = useMemo(() => resolvedBudgets({ budgets, categories, transactions }, monthKey(new Date())), [budgets, categories, transactions]);
  const periodTotals = totalsFor(rangeTransactions);

  return (
    <div className="flex w-full min-w-0 flex-col gap-4">
      <PageIntro title={tr('Reports')} subtitle="Income, spending, and how the month compared." />
      <Segmented
        label="Report period"
        value={period}
        onChange={setPeriod}
        options={[{ value: 'daily', label: 'Daily' }, { value: 'weekly', label: 'Weekly' }, { value: 'monthly', label: 'Monthly' }, { value: 'yearly', label: 'Yearly' }]}
      />
      <div className="grid w-full gap-4 lg:grid-cols-2">
        <section className="card min-w-0 p-5">
          <h2 className="font-semibold">Income vs expense</h2>
          <IncomeExpenseChart data={series} currency={settings.currency} language={settings.language} />
        </section>
        <section className="card min-w-0 p-5">
          <h2 className="font-semibold">Category spending</h2>
          <DonutChart data={spend} total={periodTotals.expense} currency={settings.currency} language={settings.language} />
        </section>
        <section className="card min-w-0 p-5">
          <h2 className="font-semibold">Savings trend</h2>
          <SavingsLine data={series} currency={settings.currency} language={settings.language} />
        </section>
        <section className="card min-w-0 p-5">
          <h2 className="mb-3 font-semibold">Budget utilization</h2>
          {utilization.length === 0 ? <p className="muted text-sm">No budgets for the current month.</p> : utilization.map((row) => (
            <div key={row.id} className="mb-3">
              <div className="mb-1 flex justify-between text-sm"><span>{row.name}</span><span>{formatPercent(row.percent, 0)}</span></div>
              <Progress value={row.percent} status={row.status} />
            </div>
          ))}
        </section>
      </div>
      <IncomeSplit month={currentMonth} />
      <SpendReview month={currentMonth} />
      <section className="card p-5">
        <h2 className="mb-3 font-semibold">Financial insights</h2>
        {insights.length === 0 ? <p className="muted text-sm">Add a few weeks of transactions to see comparisons.</p> : (
          <ul className="grid gap-2">
            {insights.map((insight) => (
              <li key={insight.id} className="rounded-xl bg-[var(--surface-2)] px-3 py-2 text-sm">{tr(insight.key, insight.vars)}</li>
            ))}
          </ul>
        )}
      </section>
      <section className="card p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-semibold">Monthly summary</h2>
          <input className="field max-w-48" type="month" value={month} onChange={(event) => setMonth(event.target.value)} aria-label="Summary month" />
        </div>
        <p className="muted mb-4 text-sm">{formatMonth(month, settings.language)}</p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Summary label={tr('Income')} value={formatMoney(summary.income, settings.currency, settings.language)} change={summary.incomeChange} />
          <Summary label={tr('Expenses')} value={formatMoney(summary.expense, settings.currency, settings.language)} change={summary.expenseChange} />
          <Summary label={tr('Savings')} value={formatMoney(summary.savings, settings.currency, settings.language)} change={summary.savingsChange} />
          <Summary label={tr('Savings rate')} value={formatPercent(summary.savingsRate, 1)} />
        </div>
        <div className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
          <p>Top category <strong>{summary.topCategory}</strong></p>
          <p>Largest expense <strong>{summary.largestExpenseName}</strong> {summary.largestExpenseAmount ? formatMoney(summary.largestExpenseAmount, settings.currency, settings.language) : ''}</p>
        </div>
      </section>
    </div>
  );
}

function Summary({ label, value, change }: { label: string; value: string; change?: string }) {
  return (
    <div>
      <div className="muted text-sm">{label}</div>
      <div className="amount text-2xl font-semibold">{value}</div>
      {change ? <div className="text-sm text-[var(--muted)]">vs previous month {change}</div> : null}
    </div>
  );
}

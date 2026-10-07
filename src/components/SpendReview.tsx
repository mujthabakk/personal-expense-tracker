import { useState } from 'react';
import { Link } from 'react-router-dom';
import { readAiKey } from '@/lib/aiKey';
import { formatMoney, formatPercent } from '@/lib/money';
import { reviewSpending } from '@/services/aiReview';
import { spendingByCategory, totalsFor } from '@/services/finance';
import { buildSpendAlerts, investmentAmount } from '@/services/spendAlerts';
import { useLedger } from '@/store/ledger';

export function SpendReview({ month }: { month: string }) {
  const transactions = useLedger((state) => state.transactions);
  const categories = useLedger((state) => state.categories);
  const budgets = useLedger((state) => state.budgets);
  const settings = useLedger((state) => state.settings);
  const totals = totalsFor(transactions, month);
  const spend = spendingByCategory(transactions, categories, month);
  const investment = investmentAmount(transactions, categories, month);
  const alerts = buildSpendAlerts(transactions, categories, budgets, month);
  const [summary, setSummary] = useState('');
  const [aiAlerts, setAiAlerts] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const money = (amount: number) => formatMoney(amount, settings.currency, settings.language);

  async function ask() {
    setBusy(true);
    setError('');
    try {
      const review = await reviewSpending(readAiKey(), {
        month,
        currency: settings.currency,
        income: totals.income,
        expenses: totals.expense,
        savings: totals.savings,
        investment,
        categories: spend,
        alerts,
      });
      setSummary(review.summary);
      setAiAlerts(review.alerts);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'The review failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card grid gap-4 p-5 lg:col-span-12">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-semibold">How this month was spent</h2>
          <p className="muted text-sm">Investment and every other category, plus alerts for high or unwanted purchases.</p>
        </div>
        <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => void ask()}>{busy ? 'Reviewing…' : 'AI review'}</button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl bg-[var(--info-bg)] px-3 py-3">
          <div className="text-xs font-semibold text-[var(--info)]">Investment</div>
          <div className="amount mt-1 text-xl font-semibold">{money(investment)}</div>
        </div>
        {spend.filter((item) => item.categoryId !== 'cat-investment').slice(0, 3).map((item) => (
          <div key={item.categoryId} className="rounded-xl bg-[var(--surface-2)] px-3 py-3">
            <div className="muted text-xs font-semibold">{item.name}</div>
            <div className="amount mt-1 text-xl font-semibold">{money(item.amount)}</div>
            <div className="muted text-xs">{formatPercent(item.percent, 0)} of spending</div>
          </div>
        ))}
      </div>

      {spend.length === 0 ? <p className="muted text-sm">No expenses this month, so there is nothing to flag.</p> : (
        <ul className="grid gap-2">
          {spend.map((item) => (
            <li key={item.categoryId} className="flex items-center justify-between gap-3 text-sm">
              <span>{item.name}</span>
              <span className="amount font-semibold">{money(item.amount)} · {formatPercent(item.percent, 0)}</span>
            </li>
          ))}
        </ul>
      )}

      {alerts.length === 0 ? <p className="text-sm text-[var(--income)]">No unwanted or unusually high spending this month.</p> : (
        <div className="grid gap-3">
          {alerts.map((alert) => (
            <article key={alert.id} className={alert.tone === 'bad' ? 'rounded-xl bg-[var(--bad-bg)] px-3 py-3' : 'rounded-xl bg-[var(--warn-bg)] px-3 py-3'}>
              <h3 className="font-semibold">{alert.title}</h3>
              <p className="mt-1 text-sm">{alert.detail}</p>
              {alert.items.length ? (
                <ul className="mt-2 grid gap-1">
                  {alert.items.map((item) => (
                    <li key={item.id} className="flex items-center justify-between gap-3 text-sm">
                      <span>{item.label} · {item.category}</span>
                      <span className="amount font-semibold text-[var(--expense)]">{money(item.amount)}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </article>
          ))}
        </div>
      )}

      {summary ? <p className="text-sm leading-6">{summary}</p> : null}
      {aiAlerts.length ? (
        <ul className="grid gap-2">
          {aiAlerts.map((item) => <li key={item} className="rounded-xl bg-[var(--warn-bg)] px-3 py-2 text-sm">{item}</li>)}
        </ul>
      ) : null}
      {error ? <p className="text-sm text-[var(--danger)]">{error}</p> : null}
      <p className="muted text-xs">AI review uses the free Gemini API. Only this month’s totals and flagged items are sent. <Link to="/profile" className="font-semibold">Add a key in Profile</Link> if you have not yet.</p>
    </section>
  );
}

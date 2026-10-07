import { Link } from 'react-router-dom';
import { IncomeSplit } from '@/components/IncomeSplit';
import { PageIntro, Progress } from '@/components/ui';
import { monthKey } from '@/lib/dates';
import { formatMoney } from '@/lib/money';
import { buildInvestmentPlan } from '@/services/investmentPlan';
import { useLedger } from '@/store/ledger';

export function PlanPage() {
  const transactions = useLedger((state) => state.transactions);
  const categories = useLedger((state) => state.categories);
  const accounts = useLedger((state) => state.accounts);
  const settings = useLedger((state) => state.settings);
  const month = monthKey(new Date());
  const plan = buildInvestmentPlan(transactions, categories, accounts, month, settings.currency, settings.language);
  const money = (amount: number) => formatMoney(amount, settings.currency, settings.language);
  const monthsCovered = Math.min(6, plan.emergencyMonths);

  return (
    <div className="flex w-full min-w-0 flex-col gap-4">
      <PageIntro title="Investment plan" subtitle="A monthly split from this month’s income, essential costs, and the cash already in your accounts." />
      <IncomeSplit month={month} />
      <section className="card p-5">
        <p className="text-sm font-semibold text-[var(--info)]">{plan.stage === 'investing' ? 'Ready to invest' : plan.stage === 'overspending' ? 'Spending comes first' : 'This month'}</p>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight">{plan.headline}</h2>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <Stat label="Income" value={money(plan.income)} />
          <Stat label="Left after spending" value={money(plan.surplus)} />
          <Stat label="Emergency fund target" value={money(plan.emergencyTarget)} />
        </div>
      </section>

      <section className="card p-5">
        <div className="mb-2 flex items-center justify-between gap-3">
          <h2 className="font-semibold">Emergency fund</h2>
          <span className="text-sm">{Math.min(6, Math.round(plan.emergencyMonths * 10) / 10)} / 6 months</span>
        </div>
        <Progress value={(monthsCovered / 6) * 100} status={monthsCovered >= 6 ? 'ok' : 'warning'} />
        <p className="muted mt-3 text-sm">Cash, bank, savings, and wallet balances count. The target is 6 months of essential costs, leaving out shopping, entertainment, and subscriptions. You have {money(plan.liquid)} set aside.</p>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        {plan.slices.length === 0 ? (
          <article className="card p-5 lg:col-span-3">
            <h2 className="font-semibold">Nothing to invest yet</h2>
            <p className="muted mt-2 text-sm">The split appears when income is higher than spending.</p>
          </article>
        ) : plan.slices.map((slice) => (
          <article key={slice.id} className="card p-5">
            <h2 className="font-semibold">{slice.name}</h2>
            <p className="display mt-3 text-3xl">{money(slice.monthly)}</p>
            <p className="muted text-sm">per month</p>
            <p className="mt-3 text-sm">{slice.note}</p>
          </article>
        ))}
      </section>

      <section className="card p-5">
        <h2 className="font-semibold">What to do</h2>
        <ol className="mt-3 grid gap-2">
          {plan.steps.map((step, index) => (
            <li key={step} className="flex gap-3 text-sm">
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[var(--surface-2)] text-xs font-semibold">{index + 1}</span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
        <div className="mt-5 flex flex-wrap gap-2">
          <Link to="/transactions/new" state={{ type: 'expense', categoryId: 'cat-investment' }} className="btn btn-primary">Record an investment</Link>
          <Link to="/goals" className="btn btn-secondary">Savings goals</Link>
        </div>
        <p className="muted mt-4 text-xs">This is a simple split from your own numbers, not personal financial advice. Index funds, PPF, and gold are examples. Pick products you understand and can leave alone.</p>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-[var(--surface-2)] px-3 py-3">
      <div className="muted text-xs font-semibold">{label}</div>
      <div className="amount mt-1 text-xl font-semibold">{value}</div>
    </div>
  );
}

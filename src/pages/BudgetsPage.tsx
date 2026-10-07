import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Icon } from '@/components/Icon';
import { Badge, Button, EmptyState, Field, Modal, PageIntro, Segmented, TextInput } from '@/components/ui';
import { Progress } from '@/components/ui';
import { useI18n } from '@/i18n';
import { formatMonth, monthKey, shiftMonth, toISODate } from '@/lib/dates';
import { formatMoney, formatPercent, parseAmount } from '@/lib/money';
import type { BudgetKind } from '@/models/types';
import { resolvedBudgets, totalsFor } from '@/services/finance';
import { useLedger, type BudgetDraft } from '@/store/ledger';

export function BudgetsPage() {
  const tr = useI18n();
  const [month, setMonth] = useState(() => monthKey(new Date()));
  const [open, setOpen] = useState(false);
  const transactions = useLedger((state) => state.transactions);
  const categories = useLedger((state) => state.categories);
  const budgets = useLedger((state) => state.budgets);
  const settings = useLedger((state) => state.settings);
  const saveBudget = useLedger((state) => state.saveBudget);
  const deleteBudget = useLedger((state) => state.deleteBudget);
  const confirm = useLedger((state) => state.confirm);
  const rows = useMemo(() => resolvedBudgets({ budgets, categories, transactions }, month), [budgets, categories, transactions, month]);
  const monthly = rows.find((row) => row.kind === 'monthly');
  const spent = totalsFor(transactions, month).expense;
  const categoryRows = rows.filter((row) => row.kind !== 'monthly');

  async function remove(id: string) {
    const ok = await confirm({ title: 'Delete budget?', message: 'This budget will be removed.', confirmLabel: 'Delete', danger: true });
    if (ok) deleteBudget(id);
  }

  return (
    <div>
      <PageIntro title={tr('Budgets')} subtitle={formatMonth(month, settings.language)} action={<Button variant="primary" onClick={() => setOpen(true)}>Create budget</Button>} />
      <div className="mb-4 flex items-center gap-2">
        <button type="button" className="icon-btn border border-[var(--line)]" aria-label="Previous month" onClick={() => setMonth(shiftMonth(month, -1))}><ChevronLeft size={18} /></button>
        <button type="button" className="icon-btn border border-[var(--line)]" aria-label="Next month" onClick={() => setMonth(shiftMonth(month, 1))}><ChevronRight size={18} /></button>
      </div>
      {rows.length === 0 ? (
        <section className="card"><EmptyState title={tr('No budgets created.')} body={tr('Create a budget to control your monthly spending.')} action={<Button variant="primary" onClick={() => setOpen(true)}>Create budget</Button>} /></section>
      ) : (
        <div className="grid gap-4">
          <section className="card grid gap-4 p-5 sm:grid-cols-3">
            <Stat label="Total budget" value={formatMoney(monthly?.limit ?? categoryRows.reduce((sum, row) => sum + row.limit, 0), settings.currency, settings.language)} />
            <Stat label="Spent" value={formatMoney(monthly?.spent ?? spent, settings.currency, settings.language)} />
            <Stat label="Remaining" value={formatMoney((monthly?.limit ?? categoryRows.reduce((sum, row) => sum + row.limit, 0)) - (monthly?.spent ?? spent), settings.currency, settings.language)} />
          </section>
          <div className="grid gap-3">
            {rows.map((row) => (
              <article key={row.id} className="card p-4">
                <div className="mb-2 flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2 font-semibold"><Icon name={row.icon} /> {row.name}</div>
                  <Badge status={row.status === 'exceeded' ? 'exceeded' : row.status === 'warning' ? 'warning' : 'ok'}>
                    {row.status === 'exceeded' ? tr('Exceeded') : row.status === 'warning' ? tr('Near limit') : tr('On track')}
                  </Badge>
                </div>
                <div className="mb-2 flex justify-between text-sm">
                  <span className="amount">{formatMoney(row.spent, settings.currency, settings.language)} / {formatMoney(row.limit, settings.currency, settings.language)}</span>
                  <span className="muted">{formatPercent(row.percent, 0)}</span>
                </div>
                <Progress value={row.percent} status={row.status} />
                <button type="button" className="mt-3 text-sm font-semibold text-[var(--danger)]" onClick={() => void remove(row.id)}>Delete</button>
              </article>
            ))}
          </div>
        </div>
      )}
      {open ? <BudgetForm month={month} onClose={() => setOpen(false)} onSave={(draft) => { const error = saveBudget(draft); return error; }} /> : null}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return <div><div className="muted text-sm">{label}</div><div className="amount mt-1 text-2xl font-semibold">{value}</div></div>;
}

function BudgetForm({ month, onClose, onSave }: { month: string; onClose: () => void; onSave: (draft: BudgetDraft) => string | null }) {
  const allCategories = useLedger((state) => state.categories);
  const categories = allCategories.filter((item) => item.type === 'expense');
  const [kind, setKind] = useState<BudgetKind>('category');
  const [name, setName] = useState('Monthly budget');
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? '');
  const [amount, setAmount] = useState('');
  const [everyMonth, setEveryMonth] = useState(true);
  const [startDate, setStartDate] = useState(toISODate(new Date()));
  const [endDate, setEndDate] = useState(toISODate(new Date()));
  const [error, setError] = useState('');

  return (
    <Modal title="Create budget" onClose={onClose}>
      <div className="grid gap-4">
        <Segmented label="Budget type" value={kind} onChange={setKind} options={[{ value: 'monthly', label: 'Monthly' }, { value: 'category', label: 'Category' }, { value: 'custom', label: 'Custom' }]} />
        {kind !== 'category' ? <Field label="Name"><TextInput value={name} onChange={(event) => setName(event.target.value)} /></Field> : null}
        {kind !== 'monthly' ? (
          <Field label="Category">
            <select className="field" value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>
              {kind === 'custom' ? <option value="">All spending</option> : null}
              {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
            </select>
          </Field>
        ) : null}
        <Field label="Amount"><TextInput inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} /></Field>
        {kind === 'category' ? <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={everyMonth} onChange={(event) => setEveryMonth(event.target.checked)} /> Use this amount every month</label> : null}
        {kind === 'custom' ? (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Start"><TextInput type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} /></Field>
            <Field label="End"><TextInput type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} /></Field>
          </div>
        ) : null}
        {error ? <p className="text-sm text-[var(--danger)]">{error}</p> : null}
        <Button variant="primary" onClick={() => {
          const message = onSave({ kind, name, categoryId, amount: parseAmount(amount), month, startDate, endDate, everyMonth });
          if (message) setError(message);
          else onClose();
        }}>Save budget</Button>
      </div>
    </Modal>
  );
}

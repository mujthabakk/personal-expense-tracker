import { useState } from 'react';
import { Icon } from '@/components/Icon';
import { Button, EmptyState, Field, Modal, PageIntro, Progress, TextInput } from '@/components/ui';
import { ICON_OPTIONS } from '@/components/Icon';
import { useI18n } from '@/i18n';
import { formatShortDate, toISODate } from '@/lib/dates';
import { formatMoney, formatPercent, parseAmount } from '@/lib/money';
import { CATEGORY_COLORS } from '@/models/types';
import { goalMonthlyNeed, goalProgress } from '@/services/finance';
import { useLedger } from '@/store/ledger';

const PRESETS = ['Emergency Fund', 'New Phone', 'Car', 'Travel', 'House', 'Education'];

export function GoalsPage() {
  const tr = useI18n();
  const goals = useLedger((state) => state.goals);
  const settings = useLedger((state) => state.settings);
  const saveGoal = useLedger((state) => state.saveGoal);
  const deleteGoal = useLedger((state) => state.deleteGoal);
  const addContribution = useLedger((state) => state.addContribution);
  const confirm = useLedger((state) => state.confirm);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);

  return (
    <div>
      <PageIntro title={tr('Goals')} subtitle="Set a target and add money as you save." action={<Button variant="primary" onClick={() => { setEditing(null); setOpen(true); }}>New goal</Button>} />
      {goals.length === 0 ? (
        <section className="card"><EmptyState title={tr('No savings goals.')} body={tr('Create your first financial goal.')} action={<Button variant="primary" onClick={() => setOpen(true)}>Create goal</Button>} /></section>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {goals.map((goal) => {
            const progress = goalProgress(goal);
            const monthly = goalMonthlyNeed(goal);
            return (
              <article key={goal.id} className="card p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2 font-semibold"><Icon name={goal.icon} /> {goal.name}</div>
                  <span className="amount text-sm">{formatPercent(progress, 0)} complete</span>
                </div>
                <p className="display mt-3 text-3xl">{formatMoney(goal.targetAmount, settings.currency, settings.language)} <span className="text-base text-[var(--muted)]">target</span></p>
                <p className="mt-1 text-sm">{formatMoney(goal.currentAmount, settings.currency, settings.language)} saved</p>
                <div className="my-3"><Progress value={progress} status="ok" /></div>
                <p className="muted text-sm">{monthly > 0 ? `${formatMoney(monthly, settings.currency, settings.language)} per month to reach ${formatShortDate(goal.targetDate, settings.language)}.` : 'Goal reached.'}</p>
                <ContributionForm goalId={goal.id} onAdd={addContribution} />
                <div className="mt-3 flex gap-3 text-sm">
                  <button type="button" className="font-semibold" onClick={() => { setEditing(goal.id); setOpen(true); }}>Edit</button>
                  <button type="button" className="font-semibold text-[var(--danger)]" onClick={async () => { if (await confirm({ title: 'Delete goal?', message: 'Saved progress for this goal will be removed.', confirmLabel: 'Delete', danger: true })) deleteGoal(goal.id); }}>Delete</button>
                </div>
              </article>
            );
          })}
        </div>
      )}
      {open ? <GoalForm id={editing} onClose={() => setOpen(false)} onSave={saveGoal} /> : null}
    </div>
  );
}

function ContributionForm({ goalId, onAdd }: { goalId: string; onAdd: (id: string, amount: number, date: string, note: string) => string | null }) {
  const [amount, setAmount] = useState('');
  const [error, setError] = useState('');
  return (
    <form className="mt-4 flex gap-2" onSubmit={(event) => {
      event.preventDefault();
      const message = onAdd(goalId, parseAmount(amount), new Date().toISOString(), '');
      if (message) setError(message);
      else { setAmount(''); setError(''); }
    }}>
      <input className="field" inputMode="decimal" placeholder="Add money" aria-label="Amount to add" value={amount} onChange={(event) => setAmount(event.target.value)} />
      <Button variant="primary" type="submit">Add</Button>
      {error ? <span className="sr-only">{error}</span> : null}
    </form>
  );
}

function GoalForm({ id, onClose, onSave }: { id: string | null; onClose: () => void; onSave: (input: { id?: string; name: string; targetAmount: number; currentAmount: number; targetDate: string; icon: string; color: string }) => string | null }) {
  const goals = useLedger((state) => state.goals);
  const existing = goals.find((goal) => goal.id === id);
  const [name, setName] = useState(existing?.name ?? PRESETS[0]);
  const [target, setTarget] = useState(existing ? String(existing.targetAmount) : '');
  const [current, setCurrent] = useState(existing ? String(existing.currentAmount) : '0');
  const [targetDate, setTargetDate] = useState(existing?.targetDate ?? toISODate(new Date(new Date().getFullYear() + 1, new Date().getMonth(), 1)));
  const [icon, setIcon] = useState(existing?.icon ?? 'target');
  const [color, setColor] = useState(existing?.color ?? CATEGORY_COLORS[0]);
  const [error, setError] = useState('');
  return (
    <Modal title={existing ? 'Edit goal' : 'New goal'} onClose={onClose}>
      <div className="grid gap-4">
        <div className="flex flex-wrap gap-2">{PRESETS.map((preset) => <button key={preset} type="button" className={name === preset ? 'chip chip-active' : 'chip'} onClick={() => setName(preset)}>{preset}</button>)}</div>
        <Field label="Goal name"><TextInput value={name} onChange={(event) => setName(event.target.value)} /></Field>
        <Field label="Target amount"><TextInput inputMode="decimal" value={target} onChange={(event) => setTarget(event.target.value)} /></Field>
        <Field label="Already saved"><TextInput inputMode="decimal" value={current} onChange={(event) => setCurrent(event.target.value)} /></Field>
        <Field label="Target date"><TextInput type="date" value={targetDate} onChange={(event) => setTargetDate(event.target.value)} /></Field>
        <div className="flex flex-wrap gap-2">{ICON_OPTIONS.slice(0, 12).map((item) => <button key={item} type="button" className={icon === item ? 'icon-btn border border-[var(--ink)]' : 'icon-btn border border-[var(--line)]'} onClick={() => setIcon(item)} aria-label={item}><Icon name={item} /></button>)}</div>
        <div className="flex gap-2">{CATEGORY_COLORS.slice(0, 8).map((item) => <button key={item} type="button" className="h-7 w-7 rounded-full border-2" style={{ background: item, borderColor: color === item ? 'var(--ink)' : 'transparent' }} aria-label={item} onClick={() => setColor(item)} />)}</div>
        {error ? <p className="text-sm text-[var(--danger)]">{error}</p> : null}
        <Button variant="primary" onClick={() => {
          const message = onSave({ id: existing?.id, name, targetAmount: parseAmount(target), currentAmount: parseAmount(current), targetDate, icon, color });
          if (message) setError(message);
          else onClose();
        }}>Save goal</Button>
      </div>
    </Modal>
  );
}

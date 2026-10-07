import { useState } from 'react';
import { Button, EmptyState, Field, Modal, PageIntro, Segmented, TextInput } from '@/components/ui';
import { FREQUENCY_LABELS, PAYMENT_LABELS } from '@/data/defaults';
import { formatMoney } from '@/lib/money';
import { parseAmount } from '@/lib/money';
import { FREQUENCIES, PAYMENT_METHODS, type Frequency, type PaymentMethod, type TransactionType } from '@/models/types';
import { reminderLabel } from '@/services/finance';
import { useLedger, type RecurringDraft } from '@/store/ledger';

export function RecurringPage() {
  const rules = useLedger((state) => state.recurring);
  const categories = useLedger((state) => state.categories);
  const settings = useLedger((state) => state.settings);
  const saveRecurring = useLedger((state) => state.saveRecurring);
  const deleteRecurring = useLedger((state) => state.deleteRecurring);
  const skipRecurring = useLedger((state) => state.skipRecurring);
  const confirm = useLedger((state) => state.confirm);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);

  return (
    <div>
      <PageIntro title="Recurring" subtitle="Rent, subscriptions, and other payments that repeat." action={<Button variant="primary" onClick={() => { setEditing(null); setOpen(true); }}>Add recurring</Button>} />
      {rules.length === 0 ? <section className="card"><EmptyState title="No recurring payments." body="Add rent, a subscription, or a bill so Folio can remind you." action={<Button variant="primary" onClick={() => setOpen(true)}>Add recurring</Button>} /></section> : (
        <div className="grid gap-3">
          {rules.map((rule) => {
            const reminder = reminderLabel(rule.nextDate);
            const category = categories.find((item) => item.id === rule.categoryId);
            return (
              <article key={rule.id} className="card p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="font-semibold">{rule.description || category?.name || 'Payment'}</h2>
                    <p className="muted text-sm">{category?.name} · {FREQUENCY_LABELS[rule.frequency]} · {PAYMENT_LABELS[rule.paymentMethod]}</p>
                  </div>
                  <div className="text-right">
                    <div className="amount font-semibold">{formatMoney(rule.amount, settings.currency, settings.language)}</div>
                    <div className={reminder.days <= rule.reminderDays ? 'text-sm text-[var(--warning)]' : 'muted text-sm'}>Next {rule.nextDate}</div>
                  </div>
                </div>
                <div className="mt-3 flex gap-3 text-sm">
                  <button type="button" className="font-semibold" onClick={() => { setEditing(rule.id); setOpen(true); }}>Edit</button>
                  <button type="button" className="font-semibold" onClick={() => skipRecurring(rule.id)}>Skip next</button>
                  <button type="button" className="font-semibold text-[var(--danger)]" onClick={async () => { if (await confirm({ title: 'Delete recurring payment?', message: 'Past transactions stay. Future ones will not be created.', confirmLabel: 'Delete', danger: true })) deleteRecurring(rule.id); }}>Delete</button>
                </div>
              </article>
            );
          })}
        </div>
      )}
      {open ? <RecurringForm id={editing} onClose={() => setOpen(false)} onSave={saveRecurring} /> : null}
    </div>
  );
}

function RecurringForm({ id, onClose, onSave }: { id: string | null; onClose: () => void; onSave: (input: RecurringDraft) => string | null }) {
  const existing = useLedger((state) => state.recurring.find((rule) => rule.id === id));
  const categories = useLedger((state) => state.categories);
  const accounts = useLedger((state) => state.accounts);
  const [type, setType] = useState<TransactionType>(existing?.type ?? 'expense');
  const [description, setDescription] = useState(existing?.description ?? '');
  const [amount, setAmount] = useState(existing ? String(existing.amount) : '');
  const [categoryId, setCategoryId] = useState(existing?.categoryId ?? categories.find((item) => item.type === 'expense')?.id ?? '');
  const [accountId, setAccountId] = useState(existing?.accountId ?? accounts[0]?.id ?? '');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(existing?.paymentMethod ?? 'bank');
  const [frequency, setFrequency] = useState<Frequency>(existing?.frequency ?? 'monthly');
  const [nextDate, setNextDate] = useState(existing?.nextDate ?? '');
  const [reminderDays, setReminderDays] = useState(String(existing?.reminderDays ?? 1));
  const [active, setActive] = useState(existing?.active ?? true);
  const [error, setError] = useState('');
  const pool = categories.filter((category) => category.type === (type === 'income' ? 'income' : 'expense'));

  return (
    <Modal title={existing ? 'Edit recurring' : 'Add recurring'} onClose={onClose}>
      <div className="grid gap-4">
        <Segmented label="Type" value={type === 'transfer' ? 'expense' : type} onChange={setType} options={[{ value: 'expense', label: 'Expense' }, { value: 'income', label: 'Income' }]} />
        <Field label="Name"><TextInput value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Rent, Netflix, Gym" /></Field>
        <Field label="Amount"><TextInput inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} /></Field>
        <Field label="Category"><select className="field" value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>{pool.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></Field>
        <Field label="Account"><select className="field" value={accountId} onChange={(event) => setAccountId(event.target.value)}>{accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</select></Field>
        <Field label="Payment"><select className="field" value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value as PaymentMethod)}>{PAYMENT_METHODS.map((method) => <option key={method} value={method}>{PAYMENT_LABELS[method]}</option>)}</select></Field>
        <Field label="Frequency"><select className="field" value={frequency} onChange={(event) => setFrequency(event.target.value as Frequency)}>{FREQUENCIES.map((item) => <option key={item} value={item}>{FREQUENCY_LABELS[item]}</option>)}</select></Field>
        <Field label="Next date"><TextInput type="date" value={nextDate} onChange={(event) => setNextDate(event.target.value)} /></Field>
        <Field label="Remind me this many days before"><TextInput inputMode="numeric" value={reminderDays} onChange={(event) => setReminderDays(event.target.value)} /></Field>
        <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={active} onChange={(event) => setActive(event.target.checked)} /> Active</label>
        {error ? <p className="text-sm text-[var(--danger)]">{error}</p> : null}
        <Button variant="primary" onClick={() => {
          const message = onSave({
            id: existing?.id,
            type,
            amount: parseAmount(amount),
            categoryId,
            accountId,
            toAccountId: '',
            paymentMethod,
            description,
            notes: existing?.notes ?? '',
            frequency,
            nextDate,
            anchorDay: Number(nextDate.slice(8, 10)) || 1,
            reminderDays: Number(reminderDays) || 0,
            active,
          });
          if (message) setError(message); else onClose();
        }}>Save</Button>
      </div>
    </Modal>
  );
}

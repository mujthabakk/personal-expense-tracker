import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { Icon } from '@/components/Icon';
import { Button, Field, PageIntro, Segmented, TextArea, TextInput } from '@/components/ui';
import { ACCOUNT_TYPE_LABELS, PAYMENT_LABELS } from '@/data/defaults';
import { useI18n } from '@/i18n';
import { combineDate, localDay, toISODate } from '@/lib/dates';
import { parseAmount } from '@/lib/money';
import { FREQUENCIES, PAYMENT_METHODS, type PaymentMethod, type TransactionType } from '@/models/types';
import { useLedger } from '@/store/ledger';

export function TransactionFormPage() {
  const tr = useI18n();
  const navigate = useNavigate();
  const { id } = useParams();
  const location = useLocation();
  const preset = location.state as { duplicateId?: string; type?: TransactionType; categoryId?: string } | null;
  const duplicateId = preset?.duplicateId;
  const transactions = useLedger((state) => state.transactions);
  const categories = useLedger((state) => state.categories);
  const accounts = useLedger((state) => state.accounts);
  const settings = useLedger((state) => state.settings);
  const saveTransaction = useLedger((state) => state.saveTransaction);
  const saveRecurring = useLedger((state) => state.saveRecurring);
  const existing = transactions.find((item) => item.id === (id ?? duplicateId));

  const [type, setType] = useState<TransactionType>(existing?.type ?? preset?.type ?? 'expense');
  const [amount, setAmount] = useState(existing && !duplicateId ? String(existing.amount) : existing ? String(existing.amount) : '');
  const [categoryId, setCategoryId] = useState(existing?.categoryId || preset?.categoryId || settings.lastCategoryId);
  const [description, setDescription] = useState(existing?.description ?? '');
  const [date, setDate] = useState(existing && !duplicateId ? localDay(existing.date) : toISODate(new Date()));
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(existing?.paymentMethod ?? settings.lastPaymentMethod);
  const [accountId, setAccountId] = useState(existing?.accountId || settings.lastAccountId || accounts[0]?.id || '');
  const [toAccountId, setToAccountId] = useState(existing?.toAccountId ?? '');
  const [notes, setNotes] = useState(existing?.notes ?? '');
  const [showNotes, setShowNotes] = useState(Boolean(existing?.notes));
  const [recurring, setRecurring] = useState(false);
  const [frequency, setFrequency] = useState<(typeof FREQUENCIES)[number]>('monthly');
  const [error, setError] = useState('');

  useEffect(() => {
    const field = document.getElementById('amount');
    if (field instanceof HTMLInputElement && !id) field.focus();
  }, [id]);

  const pool = categories.filter((category) => category.type === (type === 'income' ? 'income' : 'expense'));
  const recent = settings.recentCategoryIds.map((item) => pool.find((category) => category.id === item)).filter((item): item is NonNullable<typeof item> => Boolean(item));
  const orderedPayments = [...settings.recentPaymentMethods, ...PAYMENT_METHODS.filter((method) => !settings.recentPaymentMethods.includes(method))];
  const suggestions = useMemo(() => {
    const seen = new Set<string>();
    return transactions
      .filter((transaction) => transaction.categoryId === categoryId && transaction.description)
      .map((transaction) => transaction.description)
      .filter((item) => (seen.has(item) ? false : (seen.add(item), true)))
      .slice(0, 4);
  }, [transactions, categoryId]);

  function submit() {
    const parsed = parseAmount(amount);
    const payload = {
      id: id && !duplicateId ? id : undefined,
      type,
      amount: parsed,
      categoryId: type === 'transfer' ? '' : categoryId,
      accountId,
      toAccountId: type === 'transfer' ? toAccountId : '',
      paymentMethod,
      description,
      notes,
      date: combineDate(date),
    };
    const message = saveTransaction(payload);
    if (message) {
      setError(message);
      return;
    }
    if (recurring && !id) {
      saveRecurring({
        type,
        amount: parsed,
        categoryId: payload.categoryId,
        accountId,
        toAccountId: payload.toAccountId,
        paymentMethod,
        description,
        notes,
        frequency,
        nextDate: date,
        anchorDay: Number(date.slice(8, 10)) || 1,
        reminderDays: 1,
        active: true,
      });
    }
    navigate('/transactions');
  }

  return (
    <div className="mx-auto max-w-xl">
      <PageIntro title={id ? 'Edit transaction' : tr('Add transaction')} subtitle="Amount, category, then save." />
      <div className="card grid gap-5 p-5">
        <Segmented
          label="Transaction type"
          value={type}
          onChange={(value) => {
            setType(value);
            if (value !== 'transfer') {
              const match = categories.find((category) => category.id === categoryId && category.type === value);
              if (!match) setCategoryId('');
            }
          }}
          options={[{ value: 'expense', label: tr('Expense') }, { value: 'income', label: tr('Income') }, { value: 'transfer', label: tr('Transfer') }]}
        />
        <Field label={tr('Amount')} error={error && !parseAmount(amount) ? error : undefined}>
          <input id="amount" className="display field text-4xl" inputMode="decimal" autoComplete="off" placeholder="0" value={amount} onChange={(event) => setAmount(event.target.value)} aria-label={tr('Amount')} />
        </Field>
        {type !== 'transfer' ? (
          <div>
            <div className="label">{tr('Category')}</div>
            {recent.length ? <p className="muted mb-2 text-xs">Recent</p> : null}
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {(recent.length ? [...recent, ...pool.filter((category) => !recent.some((item) => item.id === category.id))] : pool).map((category) => (
                <button key={category.id} type="button" className={category.id === categoryId ? 'chip chip-active justify-start' : 'chip justify-start'} onClick={() => setCategoryId(category.id)}>
                  <Icon name={category.icon} size={16} /> {category.name}
                </button>
              ))}
            </div>
            <Link to="/categories" className="mt-2 inline-block text-sm font-semibold">New category</Link>
          </div>
        ) : null}
        <Field label={tr('Description')}>
          <TextInput value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Optional" maxLength={140} />
        </Field>
        {suggestions.length ? (
          <div className="flex flex-wrap gap-2">
            {suggestions.map((item) => <button key={item} type="button" className="chip" onClick={() => setDescription(item)}>{item}</button>)}
          </div>
        ) : null}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={tr('Date')}><TextInput type="date" value={date} onChange={(event) => setDate(event.target.value)} /></Field>
          <Field label={tr('Account')}>
            <select className="field" value={accountId} onChange={(event) => setAccountId(event.target.value)}>
              {accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}
            </select>
          </Field>
        </div>
        {type === 'transfer' ? (
          <Field label="To account">
            <select className="field" value={toAccountId} onChange={(event) => setToAccountId(event.target.value)}>
              <option value="">Choose</option>
              {accounts.filter((account) => account.id !== accountId).map((account) => <option key={account.id} value={account.id}>{account.name} · {ACCOUNT_TYPE_LABELS[account.type]}</option>)}
            </select>
          </Field>
        ) : null}
        <div>
          <div className="label">{tr('Payment method')}</div>
          <div className="flex flex-wrap gap-2">
            {orderedPayments.map((method) => (
              <button key={method} type="button" className={method === paymentMethod ? 'chip chip-active' : 'chip'} onClick={() => setPaymentMethod(method)}>{PAYMENT_LABELS[method]}</button>
            ))}
          </div>
        </div>
        <button type="button" className="text-left text-sm font-semibold" onClick={() => setShowNotes((open) => !open)}>{showNotes ? 'Hide notes' : tr('Notes')}</button>
        {showNotes ? <TextArea value={notes} onChange={(event) => setNotes(event.target.value)} maxLength={2000} /> : null}
        {!id ? (
          <div className="rounded-xl border border-[var(--line)] p-3">
            <label className="flex items-center justify-between gap-3 font-semibold">
              Recurring
              <input type="checkbox" checked={recurring} onChange={(event) => setRecurring(event.target.checked)} />
            </label>
            {recurring ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {FREQUENCIES.map((item) => (
                  <button key={item} type="button" className={item === frequency ? 'chip chip-active' : 'chip'} onClick={() => setFrequency(item)}>{item}</button>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
        {error ? <p className="text-sm text-[var(--danger)]">{error}</p> : null}
        <div className="flex gap-2">
          <Button variant="primary" onClick={submit}>{tr('Save')}</Button>
          <Button onClick={() => navigate(-1)}>{tr('Cancel')}</Button>
        </div>
      </div>
    </div>
  );
}

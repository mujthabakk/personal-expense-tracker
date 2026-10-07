import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '@/components/Icon';
import { Button, EmptyState, Field, Modal, PageIntro, SelectInput, TextInput } from '@/components/ui';
import { ACCOUNT_TYPE_LABELS } from '@/data/defaults';
import { formatMoney, formatSigned, parseAmount } from '@/lib/money';
import { ACCOUNT_TYPES, CATEGORY_COLORS, type AccountType } from '@/models/types';
import { accountFlow, computeAccountBalance, transactionTitle } from '@/services/finance';
import { useLedger } from '@/store/ledger';

export function AccountsPage() {
  const accounts = useLedger((state) => state.accounts);
  const transactions = useLedger((state) => state.transactions);
  const categories = useLedger((state) => state.categories);
  const settings = useLedger((state) => state.settings);
  const saveAccount = useLedger((state) => state.saveAccount);
  const deleteAccount = useLedger((state) => state.deleteAccount);
  const saveTransaction = useLedger((state) => state.saveTransaction);
  const confirm = useLedger((state) => state.confirm);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [selected, setSelected] = useState(accounts[0]?.id ?? '');
  const [transfer, setTransfer] = useState(false);
  const current = accounts.find((account) => account.id === selected) ?? accounts[0];

  const rows = useMemo(() => transactions.filter((item) => current && (item.accountId === current.id || item.toAccountId === current.id)).slice(0, 8), [transactions, current]);

  return (
    <div>
      <PageIntro title="Accounts" subtitle="Balances update from opening amounts and transactions." action={<Button variant="primary" onClick={() => { setEditing(null); setOpen(true); }}>Add account</Button>} />
      {accounts.length === 0 ? <section className="card"><EmptyState title="No accounts." body="Add cash or a bank account to start tracking." /></section> : (
        <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
          <div className="grid gap-2">
            {accounts.map((account) => {
              const balance = computeAccountBalance(account, transactions);
              return (
                <button key={account.id} type="button" className={account.id === current?.id ? 'card p-4 text-left ring-1 ring-[var(--ink)]' : 'card p-4 text-left'} onClick={() => setSelected(account.id)}>
                  <div className="flex items-center gap-2 font-semibold"><Icon name={account.icon} /> {account.name}</div>
                  <div className="muted text-xs">{ACCOUNT_TYPE_LABELS[account.type]}</div>
                  <div className="amount mt-2 text-lg font-semibold">{formatMoney(balance, settings.currency, settings.language)}</div>
                </button>
              );
            })}
          </div>
          {current ? <AccountDetail accountId={current.id} rows={rows} categories={categories} onEdit={() => { setEditing(current.id); setOpen(true); }} onDelete={async () => {
            const reassign = accounts.find((account) => account.id !== current.id)?.id ?? '';
            const ok = await confirm({ title: `Delete ${current.name}?`, message: 'Transactions on this account move to another account.', confirmLabel: 'Delete', danger: true });
            if (ok) deleteAccount(current.id, reassign);
          }} onTransfer={() => setTransfer(true)} /> : null}
        </div>
      )}
      {open ? <AccountForm id={editing} onClose={() => setOpen(false)} onSave={saveAccount} /> : null}
      {transfer && current ? <TransferForm fromId={current.id} onClose={() => setTransfer(false)} onSave={saveTransaction} /> : null}
    </div>
  );
}

function AccountDetail({ accountId, rows, categories, onEdit, onDelete, onTransfer }: { accountId: string; rows: ReturnType<typeof useLedger.getState>['transactions']; categories: ReturnType<typeof useLedger.getState>['categories']; onEdit: () => void; onDelete: () => void; onTransfer: () => void }) {
  const accounts = useLedger((state) => state.accounts);
  const transactions = useLedger((state) => state.transactions);
  const settings = useLedger((state) => state.settings);
  const account = accounts.find((item) => item.id === accountId);
  if (!account) return null;
  const flow = accountFlow(account.id, transactions);
  const balance = computeAccountBalance(account, transactions);
  return (
    <section className="card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">{account.name}</h2>
          <p className="muted text-sm">{account.institution || ACCOUNT_TYPE_LABELS[account.type]}</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" onClick={onTransfer}>Transfer</Button>
          <Button size="sm" onClick={onEdit}>Edit</Button>
          <Button size="sm" variant="danger" onClick={onDelete}>Delete</Button>
        </div>
      </div>
      <p className="display mt-4 text-4xl">{formatMoney(balance, settings.currency, settings.language)}</p>
      <p className="muted text-sm">{account.type === 'credit_card' ? 'Outstanding' : 'Current balance'}</p>
      <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <div>Income <strong className="amount block text-[var(--income)]">{formatMoney(flow.income, settings.currency, settings.language)}</strong></div>
        <div>Expenses <strong className="amount block text-[var(--expense)]">{formatMoney(flow.expense, settings.currency, settings.language)}</strong></div>
      </div>
      <h3 className="mb-2 mt-6 font-semibold">Transactions</h3>
      {rows.length === 0 ? <p className="muted text-sm">No transactions on this account.</p> : rows.map((transaction) => (
        <Link key={transaction.id} to={`/transactions/${transaction.id}/edit`} className="row-btn">
          <span className="font-medium">{transactionTitle(transaction, categories)}</span>
          <span />
          <span className="amount">{formatSigned(transaction.type, transaction.amount, settings.currency, settings.language)}</span>
        </Link>
      ))}
    </section>
  );
}

function AccountForm({ id, onClose, onSave }: { id: string | null; onClose: () => void; onSave: (input: { id?: string; name: string; type: AccountType; openingBalance: number; institution: string; color: string; icon: string }) => string | null }) {
  const existing = useLedger((state) => state.accounts.find((account) => account.id === id));
  const [name, setName] = useState(existing?.name ?? '');
  const [type, setType] = useState<AccountType>(existing?.type ?? 'bank');
  const [opening, setOpening] = useState(existing ? String(existing.openingBalance) : '0');
  const [institution, setInstitution] = useState(existing?.institution ?? '');
  const [error, setError] = useState('');
  return (
    <Modal title={existing ? 'Edit account' : 'Add account'} onClose={onClose}>
      <div className="grid gap-4">
        <Field label="Name"><TextInput value={name} onChange={(event) => setName(event.target.value)} placeholder="HDFC, Cash, Wallet" /></Field>
        <Field label="Type">
          <SelectInput value={type} onChange={(event) => setType(event.target.value as AccountType)}>
            {ACCOUNT_TYPES.map((item) => <option key={item} value={item}>{ACCOUNT_TYPE_LABELS[item]}</option>)}
          </SelectInput>
        </Field>
        <Field label="Institution"><TextInput value={institution} onChange={(event) => setInstitution(event.target.value)} /></Field>
        <Field label="Opening balance" hint="Amount in this account before tracked transactions. Credit cards: amount owed."><TextInput inputMode="decimal" value={opening} onChange={(event) => setOpening(event.target.value)} /></Field>
        {error ? <p className="text-sm text-[var(--danger)]">{error}</p> : null}
        <Button variant="primary" onClick={() => {
          const message = onSave({ id: existing?.id, name, type, openingBalance: parseAmount(opening), institution, color: existing?.color ?? CATEGORY_COLORS[0], icon: type === 'cash' ? 'cash' : type === 'credit_card' ? 'card' : type === 'savings' ? 'savings' : 'bank' });
          if (message) setError(message); else onClose();
        }}>Save account</Button>
      </div>
    </Modal>
  );
}

function TransferForm({ fromId, onClose, onSave }: { fromId: string; onClose: () => void; onSave: (input: { type: 'transfer'; amount: number; categoryId: string; accountId: string; toAccountId: string; paymentMethod: 'bank'; description: string; notes: string; date: string }) => string | null }) {
  const accounts = useLedger((state) => state.accounts);
  const [toAccountId, setToAccountId] = useState(accounts.find((account) => account.id !== fromId)?.id ?? '');
  const [amount, setAmount] = useState('');
  const [error, setError] = useState('');
  return (
    <Modal title="Transfer" onClose={onClose}>
      <div className="grid gap-4">
        <Field label="To">
          <SelectInput value={toAccountId} onChange={(event) => setToAccountId(event.target.value)}>
            {accounts.filter((account) => account.id !== fromId).map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}
          </SelectInput>
        </Field>
        <Field label="Amount"><TextInput inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} /></Field>
        {error ? <p className="text-sm text-[var(--danger)]">{error}</p> : null}
        <Button variant="primary" onClick={() => {
          const message = onSave({ type: 'transfer', amount: parseAmount(amount), categoryId: '', accountId: fromId, toAccountId, paymentMethod: 'bank', description: 'Transfer', notes: '', date: new Date().toISOString() });
          if (message) setError(message); else onClose();
        }}>Move money</Button>
      </div>
    </Modal>
  );
}

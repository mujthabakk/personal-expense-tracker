import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Copy, Pencil, Trash2 } from 'lucide-react';
import { Icon } from '@/components/Icon';
import { EmptyState, PageIntro, SelectInput, TextInput } from '@/components/ui';
import { useI18n } from '@/i18n';
import { chartColor } from '@/lib/color';
import { formatDay, localDay } from '@/lib/dates';
import { formatSigned } from '@/lib/money';
import { PAYMENT_LABELS } from '@/data/defaults';
import { PAYMENT_METHODS, type PaymentMethod, type TransactionType } from '@/models/types';
import { groupByDate, sortTransactions, transactionMatches, transactionTitle, type SortKey } from '@/services/finance';
import { useLedger } from '@/store/ledger';

function useDebounced(value: string, delay = 200) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

export function TransactionsPage() {
  const tr = useI18n();
  const [params] = useSearchParams();
  const transactions = useLedger((state) => state.transactions);
  const categories = useLedger((state) => state.categories);
  const accounts = useLedger((state) => state.accounts);
  const settings = useLedger((state) => state.settings);
  const remove = useLedger((state) => state.deleteTransaction);
  const confirm = useLedger((state) => state.confirm);
  const [query, setQuery] = useState(params.get('q') ?? '');
  const debounced = useDebounced(query);
  const [type, setType] = useState<TransactionType | 'all'>('all');
  const [sort, setSort] = useState<SortKey>('date_desc');
  const [categoryId, setCategoryId] = useState('');
  const [accountId, setAccountId] = useState('');
  const [payment, setPayment] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [filters, setFilters] = useState(false);
  const [visible, setVisible] = useState(50);
  const [menu, setMenu] = useState<string | null>(null);

  useEffect(() => setQuery(params.get('q') ?? ''), [params]);

  const filtered = useMemo(() => {
    const matched = transactions.filter((transaction) => {
      if (type !== 'all' && transaction.type !== type) return false;
      if (categoryId && transaction.categoryId !== categoryId) return false;
      if (accountId && transaction.accountId !== accountId && transaction.toAccountId !== accountId) return false;
      if (payment && transaction.paymentMethod !== payment) return false;
      const day = localDay(transaction.date);
      if (from && day < from) return false;
      if (to && day > to) return false;
      return transactionMatches(transaction, debounced, categories, accounts);
    });
    return sortTransactions(matched, sort);
  }, [transactions, type, categoryId, accountId, payment, from, to, debounced, categories, accounts, sort]);

  const shown = filtered.slice(0, visible);
  const groups = sort.startsWith('date') ? groupByDate(shown) : [{ date: '', items: shown }];

  async function onDelete(id: string) {
    const ok = await confirm({ title: 'Delete transaction?', message: 'This removes it from this device and from your next sync.', confirmLabel: 'Delete', danger: true });
    if (ok) remove(id);
  }

  return (
    <div>
      <PageIntro title={tr('Transactions')} subtitle={`${filtered.length} records`} action={<Link to="/transactions/new" className="btn btn-primary">Add</Link>} />
      <div className="mb-4 grid gap-3 md:grid-cols-[1fr_auto_auto]">
        <TextInput value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search description, category, amount" aria-label={tr('Search')} />
        <button type="button" className="btn btn-secondary" onClick={() => setFilters((open) => !open)}>{tr('Filter')}</button>
        <SelectInput aria-label="Sort" value={sort} onChange={(event) => setSort(event.target.value as SortKey)}>
          <option value="date_desc">Newest</option>
          <option value="date_asc">Oldest</option>
          <option value="amount_desc">Amount high</option>
          <option value="amount_asc">Amount low</option>
        </SelectInput>
      </div>
      <div className="mb-4 flex gap-2 overflow-auto">
        {(['all', 'income', 'expense', 'transfer'] as const).map((item) => (
          <button key={item} type="button" className={item === type ? 'chip chip-active' : 'chip'} onClick={() => setType(item)}>
            {item === 'all' ? 'All' : tr(item === 'income' ? 'Income' : item === 'expense' ? 'Expense' : 'Transfer')}
          </button>
        ))}
      </div>
      {filters ? (
        <div className="card mb-4 grid gap-3 p-4 md:grid-cols-4">
          <label className="text-sm font-semibold">From<TextInput type="date" value={from} onChange={(event) => setFrom(event.target.value)} /></label>
          <label className="text-sm font-semibold">To<TextInput type="date" value={to} onChange={(event) => setTo(event.target.value)} /></label>
          <label className="text-sm font-semibold">Category
            <SelectInput value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>
              <option value="">Any</option>
              {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
            </SelectInput>
          </label>
          <label className="text-sm font-semibold">Account
            <SelectInput value={accountId} onChange={(event) => setAccountId(event.target.value)}>
              <option value="">Any</option>
              {accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}
            </SelectInput>
          </label>
          <label className="text-sm font-semibold md:col-span-2">Payment
            <SelectInput value={payment} onChange={(event) => setPayment(event.target.value)}>
              <option value="">Any</option>
              {PAYMENT_METHODS.map((method) => <option key={method} value={method}>{PAYMENT_LABELS[method as PaymentMethod]}</option>)}
            </SelectInput>
          </label>
          <button type="button" className="btn btn-ghost md:col-span-2" onClick={() => { setFrom(''); setTo(''); setCategoryId(''); setAccountId(''); setPayment(''); }}>Clear filters</button>
        </div>
      ) : null}

      {filtered.length === 0 ? (
        <section className="card">
          <EmptyState title={transactions.length ? 'No matching transactions.' : tr('No transactions yet.')} body={transactions.length ? 'Try a different search or filter.' : tr('Start tracking your spending by adding your first expense.')} action={<Link to="/transactions/new" className="btn btn-primary">Add expense</Link>} />
        </section>
      ) : (
        <div className="grid gap-4">
          {groups.map((group) => (
            <section key={group.date || 'flat'} className="card p-2">
              {group.date ? <h2 className="px-3 pt-2 text-sm font-semibold">{formatDay(group.date, settings.language)}</h2> : null}
              {group.items.map((transaction) => {
                const category = categories.find((item) => item.id === transaction.categoryId);
                return (
                  <div key={transaction.id} className="relative">
                    <div className="row-btn">
                      <span className="grid h-10 w-10 place-items-center rounded-xl" style={{ background: `${chartColor(category?.color ?? '#5b7c99')}22`, color: chartColor(category?.color ?? '#5b7c99') }}>
                        <Icon name={transaction.type === 'transfer' ? 'transfer' : category?.icon ?? 'circle'} />
                      </span>
                      <span>
                        <span className="block font-semibold">{transactionTitle(transaction, categories)}</span>
                        <span className="muted block text-xs">{category?.name ?? 'Transfer'} · {PAYMENT_LABELS[transaction.paymentMethod]}</span>
                      </span>
                      <span className="flex items-center gap-2">
                        <span className={transaction.type === 'expense' ? 'amount font-semibold text-[var(--expense)]' : transaction.type === 'income' ? 'amount font-semibold text-[var(--income)]' : 'amount font-semibold'}>
                          {formatSigned(transaction.type, transaction.amount, settings.currency, settings.language)}
                        </span>
                        <button type="button" className="icon-btn" aria-label="Actions" onClick={() => setMenu(menu === transaction.id ? null : transaction.id)}>···</button>
                      </span>
                    </div>
                    {menu === transaction.id ? (
                      <div className="menu">
                        <Link to={`/transactions/${transaction.id}/edit`} className="flex min-h-10 items-center gap-2 rounded-lg px-2 font-semibold"><Pencil size={16} /> {tr('Edit')}</Link>
                        <Link to="/transactions/new" state={{ duplicateId: transaction.id }} className="flex min-h-10 items-center gap-2 rounded-lg px-2 font-semibold"><Copy size={16} /> {tr('Duplicate')}</Link>
                        <button type="button" onClick={() => void onDelete(transaction.id)}><Trash2 size={16} /> {tr('Delete')}</button>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </section>
          ))}
          {visible < filtered.length ? (
            <button type="button" className="btn btn-secondary" onClick={() => setVisible((count) => count + 50)}>Load more · {visible} of {filtered.length}</button>
          ) : null}
        </div>
      )}
    </div>
  );
}

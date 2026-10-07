import { formatMoney } from '@/lib/money';
import { buildIncomeSplit } from '@/services/incomeSplit';
import { useLedger } from '@/store/ledger';

export function IncomeSplit({ month }: { month: string }) {
  const transactions = useLedger((state) => state.transactions);
  const categories = useLedger((state) => state.categories);
  const settings = useLedger((state) => state.settings);
  const split = buildIncomeSplit(transactions, categories, month);
  const money = (amount: number) => formatMoney(amount, settings.currency, settings.language);
  if (split.income <= 0) return null;

  const family = split.buckets.find((bucket) => bucket.id === 'family');
  const investment = split.buckets.find((bucket) => bucket.id === 'investment');

  return (
    <section className="card flex w-full flex-col gap-4 p-5">
      <div>
        <h2 className="font-semibold">How to use {money(split.income)}</h2>
        <p className="muted mt-1 text-sm">
          Use {money(family?.planned ?? 0)} for family and {money(investment?.planned ?? 0)} for investment. The rest covers food, bills, personal spending, and what you keep.
        </p>
      </div>
      <ul className="grid gap-2">
        {split.buckets.map((bucket) => {
          const gap = bucket.spent - bucket.planned;
          return (
            <li key={bucket.id} className="grid gap-1 rounded-xl bg-[var(--surface-2)] px-3 py-3 sm:grid-cols-[1fr_auto_auto] sm:items-center">
              <span className="font-semibold">{bucket.name}</span>
              <span className="amount text-sm">Plan {money(bucket.planned)}</span>
              <span className={gap > 0 ? 'amount text-sm font-semibold text-[var(--expense)]' : 'amount text-sm text-[var(--income)]'}>
                Spent {money(bucket.spent)}{gap > 0 ? ` · over ${money(gap)}` : gap < 0 && bucket.id === 'investment' ? ` · put ${money(-gap)}` : ''}
              </span>
            </li>
          );
        })}
        <li className="grid gap-1 rounded-xl bg-[var(--info-bg)] px-3 py-3 sm:grid-cols-[1fr_auto] sm:items-center">
          <span className="font-semibold">Keep</span>
          <span className="amount text-sm">Plan {money(split.keep)}</span>
        </li>
        {split.otherSpent > 0 ? (
          <li className="flex items-center justify-between gap-3 px-1 text-sm">
            <span className="muted">Other spending</span>
            <span className="amount font-semibold">{money(split.otherSpent)}</span>
          </li>
        ) : null}
      </ul>
    </section>
  );
}

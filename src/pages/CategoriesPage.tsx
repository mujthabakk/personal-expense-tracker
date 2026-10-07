import { useState } from 'react';
import { Icon, ICON_OPTIONS } from '@/components/Icon';
import { Button, Field, Modal, PageIntro, Segmented, TextInput } from '@/components/ui';
import { parseAmount } from '@/lib/money';
import { CATEGORY_COLORS, type Category } from '@/models/types';
import { useLedger } from '@/store/ledger';

export function CategoriesPage() {
  const categories = useLedger((state) => state.categories);
  const saveCategory = useLedger((state) => state.saveCategory);
  const deleteCategory = useLedger((state) => state.deleteCategory);
  const confirm = useLedger((state) => state.confirm);
  const [type, setType] = useState<'expense' | 'income'>('expense');
  const [editing, setEditing] = useState<Category | null>(null);
  const [open, setOpen] = useState(false);
  const visible = categories.filter((category) => category.type === type);

  return (
    <div>
      <PageIntro title="Categories" subtitle="Icons, colors, and a monthly category budget." action={<Button variant="primary" onClick={() => { setEditing(null); setOpen(true); }}>Create category</Button>} />
      <Segmented label="Category type" value={type} onChange={setType} options={[{ value: 'expense', label: 'Expense' }, { value: 'income', label: 'Income' }]} />
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {visible.map((category) => (
          <article key={category.id} className="card flex items-center gap-3 p-4">
            <span className="grid h-10 w-10 place-items-center rounded-xl text-white" style={{ background: category.color }}><Icon name={category.icon} /></span>
            <div className="min-w-0 flex-1">
              <div className="font-semibold">{category.name}</div>
              <div className="muted text-xs">{category.budgetAmount > 0 ? `Budget ${category.budgetAmount}` : 'No category budget'}</div>
            </div>
            <button type="button" className="text-sm font-semibold" onClick={() => { setEditing(category); setOpen(true); }}>Edit</button>
            <button type="button" className="text-sm font-semibold text-[var(--danger)]" onClick={async () => {
              const reassign = categories.find((item) => item.type === category.type && item.id !== category.id)?.id ?? '';
              const ok = await confirm({ title: `Delete ${category.name}?`, message: 'Existing transactions can be moved to another category.', confirmLabel: 'Delete', danger: true });
              if (ok) deleteCategory(category.id, reassign);
            }}>Delete</button>
          </article>
        ))}
      </div>
      {open ? <CategoryForm category={editing} type={type} onClose={() => setOpen(false)} onSave={saveCategory} /> : null}
    </div>
  );
}

function CategoryForm({ category, type, onClose, onSave }: { category: Category | null; type: 'expense' | 'income'; onClose: () => void; onSave: (input: { id?: string; name: string; type: 'expense' | 'income'; icon: string; color: string; budgetAmount: number }) => string | null }) {
  const [name, setName] = useState(category?.name ?? '');
  const [kind, setKind] = useState<'expense' | 'income'>(category?.type ?? type);
  const [icon, setIcon] = useState(category?.icon ?? 'circle');
  const [color, setColor] = useState(category?.color ?? CATEGORY_COLORS[0]);
  const [budget, setBudget] = useState(category ? String(category.budgetAmount || '') : '');
  const [error, setError] = useState('');
  return (
    <Modal title={category ? 'Edit category' : 'Create category'} onClose={onClose}>
      <div className="grid gap-4">
        <Field label="Name"><TextInput value={name} onChange={(event) => setName(event.target.value)} /></Field>
        <Segmented label="Type" value={kind} onChange={setKind} options={[{ value: 'expense', label: 'Expense' }, { value: 'income', label: 'Income' }]} />
        <div className="flex flex-wrap gap-2">{ICON_OPTIONS.map((item) => <button key={item} type="button" className={icon === item ? 'icon-btn border border-[var(--ink)]' : 'icon-btn border border-[var(--line)]'} aria-label={item} onClick={() => setIcon(item)}><Icon name={item} /></button>)}</div>
        <div className="flex flex-wrap gap-2">{CATEGORY_COLORS.map((item) => <button key={item} type="button" aria-label={item} className="h-7 w-7 rounded-full border-2" style={{ background: item, borderColor: color === item ? 'var(--ink)' : 'transparent' }} onClick={() => setColor(item)} />)}</div>
        {kind === 'expense' ? <Field label="Monthly budget" hint="Leave blank for no limit."><TextInput inputMode="decimal" value={budget} onChange={(event) => setBudget(event.target.value)} /></Field> : null}
        {error ? <p className="text-sm text-[var(--danger)]">{error}</p> : null}
        <Button variant="primary" onClick={() => {
          const message = onSave({ id: category?.id, name, type: kind, icon, color, budgetAmount: budget ? parseAmount(budget) : 0 });
          if (message) setError(message); else onClose();
        }}>Save category</Button>
      </div>
    </Modal>
  );
}

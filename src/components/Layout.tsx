import { useEffect } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { Bell, PieChart, Plus, Search, UserRound, Wallet } from 'lucide-react';
import { Icon } from '@/components/Icon';
import { useI18n } from '@/i18n';
import { cx } from '@/lib/cx';
import { isFirebaseConfigured } from '@/lib/firebase';
import { unreadCount } from '@/services/notifications';
import { useLedger } from '@/store/ledger';

const primary = [
  { to: '/', label: 'Home', icon: 'home', end: true },
  { to: '/transactions', label: 'Transactions', icon: 'receipt', end: false },
  { to: '/budgets', label: 'Budgets', icon: 'target', end: true },
  { to: '/reports', label: 'Reports', icon: 'chart', end: true },
  { to: '/profile', label: 'Profile', icon: 'users', end: true },
];

const secondary = [
  { to: '/goals', label: 'Goals', icon: 'savings' },
  { to: '/recurring', label: 'Recurring', icon: 'repeat' },
  { to: '/accounts', label: 'Accounts', icon: 'bank' },
  { to: '/categories', label: 'Categories', icon: 'bag' },
];

function Wordmark() {
  return (
    <span className="flex items-center gap-2 font-semibold tracking-tight">
      <span className="grid h-8 w-8 place-items-center rounded-lg bg-[#171b22] text-xs text-white">F</span>
      Folio
    </span>
  );
}

export function Layout() {
  const tr = useI18n();
  const navigate = useNavigate();
  const syncStatus = useLedger((state) => state.syncStatus);
  const online = useLedger((state) => state.online);
  const authUser = useLedger((state) => state.authUser);
  const unread = useLedger((state) => unreadCount(state.notifications));
  const statusLabel = !online ? tr('Offline') : !isFirebaseConfigured() || !authUser ? tr('Private · on this device') : syncStatus === 'syncing' ? tr('Syncing') : syncStatus === 'error' ? 'Sync paused' : tr('Synced');

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target || target.closest('input, textarea, select')) return;
      if (event.key.toLowerCase() === 'n' && !event.metaKey && !event.ctrlKey && !event.altKey) {
        event.preventDefault();
        navigate('/transactions/new');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [navigate]);

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[240px_1fr]">
      <a className="skip-link" href="#main">Skip to content</a>
      <aside className="sticky top-0 hidden h-screen flex-col border-r border-[var(--line)] bg-[var(--surface)] p-4 lg:flex">
        <div className="px-2 py-2"><Wordmark /></div>
        <p className="muted px-2 pb-4 text-xs">Personal finance</p>
        <nav aria-label="Primary" className="grid gap-1">
          {primary.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end} className={({ isActive }) => cx('nav-link', isActive && 'nav-link-active')}>
              <Icon name={item.icon} />
              {tr(item.label)}
            </NavLink>
          ))}
        </nav>
        <p className="muted px-3 pb-2 pt-6 text-xs font-semibold uppercase tracking-wide">Plan</p>
        <nav aria-label="Manage" className="grid gap-1">
          {secondary.map((item) => (
            <NavLink key={item.to} to={item.to} className={({ isActive }) => cx('nav-link', isActive && 'nav-link-active')}>
              <Icon name={item.icon} />
              {tr(item.label)}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto px-2 pt-4 text-xs text-[var(--muted)]">{statusLabel}</div>
      </aside>
      <div className="min-w-0">
        <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-[var(--line)] bg-[var(--bg)] px-4 py-3 lg:px-8">
          <div className="lg:hidden"><Wordmark /></div>
          <form
            className="ml-auto hidden min-w-0 flex-1 md:block md:max-w-md"
            onSubmit={(event) => {
              event.preventDefault();
              const data = new FormData(event.currentTarget);
              navigate(`/transactions?q=${encodeURIComponent(String(data.get('q') ?? ''))}`);
            }}
          >
            <label className="relative block">
              <span className="sr-only">{tr('Search')}</span>
              <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" />
              <input name="q" className="field pl-9" placeholder="Search transactions" />
            </label>
          </form>
          <button type="button" className="icon-btn md:hidden" aria-label={tr('Search')} onClick={() => navigate('/transactions')}>
            <Search size={18} />
          </button>
          <button type="button" className="icon-btn relative" aria-label={tr('Notifications')} onClick={() => navigate('/notifications')}>
            <Bell size={18} />
            {unread > 0 ? <span className="absolute right-1 top-1 grid h-4 min-w-4 place-items-center rounded-full bg-[var(--expense)] px-1 text-[10px] text-white">{unread}</span> : null}
          </button>
          <button type="button" className="btn btn-primary hidden items-center md:inline-flex" onClick={() => navigate('/transactions/new')}>
            <Plus size={16} /> {tr('Add transaction')}
          </button>
        </header>
        <main id="main" className="mx-auto w-full max-w-6xl px-4 py-5 pb-28 lg:px-8 lg:py-8 lg:pb-10">
          <Outlet />
        </main>
      </div>
      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-[var(--line)] bg-[var(--surface)] px-1 py-2 lg:hidden" aria-label="Primary">
        {primary.map((item) => (
          <NavLink key={item.to} to={item.to} end={item.end} className={({ isActive }) => cx('tab', isActive && 'tab-active')}>
            {item.label === 'Home' ? <HouseIcon /> : item.label === 'Reports' ? <PieChart size={18} /> : item.label === 'Profile' ? <UserRound size={18} /> : item.label === 'Budgets' ? <Wallet size={18} /> : <Icon name="receipt" />}
            {tr(item.label)}
          </NavLink>
        ))}
      </nav>
      <button type="button" className="fixed bottom-20 right-4 z-30 grid h-14 w-14 place-items-center rounded-full bg-[var(--accent)] text-[var(--accent-ink)] shadow-lg lg:hidden" aria-label={tr('Add transaction')} onClick={() => navigate('/transactions/new')}>
        <Plus />
      </button>
    </div>
  );
}

function HouseIcon() {
  return <Icon name="home" />;
}

export function Feedback() {
  const toasts = useLedger((state) => state.toasts);
  const dialog = useLedger((state) => state.dialog);
  const dismissToast = useLedger((state) => state.dismissToast);
  const closeDialog = useLedger((state) => state.closeDialog);
  const tr = useI18n();
  return (
    <>
      <div className="toast-wrap" aria-live="polite">
        {toasts.map((toast) => (
          <div className="toast" key={toast.id}>
            <span>{tr(toast.message)}</span>
            <button type="button" className="text-sm font-semibold underline" onClick={() => dismissToast(toast.id)}>OK</button>
          </div>
        ))}
      </div>
      {dialog ? (
        <div className="modal-backdrop">
          <div className="modal" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title">
            <h2 id="confirm-title" className="text-lg font-semibold">{dialog.title}</h2>
            <p className="muted mt-2 text-sm">{dialog.message}</p>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" className="btn btn-secondary" onClick={() => closeDialog(false)}>{tr('Cancel')}</button>
              <button type="button" className={cx('btn', dialog.danger ? 'btn-danger' : 'btn-primary')} onClick={() => closeDialog(true)}>{dialog.confirmLabel}</button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

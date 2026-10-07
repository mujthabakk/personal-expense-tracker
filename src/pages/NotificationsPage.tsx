import { Link } from 'react-router-dom';
import { EmptyState, PageIntro } from '@/components/ui';
import { useI18n } from '@/i18n';
import { useLedger } from '@/store/ledger';

export function NotificationsPage() {
  const tr = useI18n();
  const notifications = useLedger((state) => state.notifications);
  const markRead = useLedger((state) => state.markRead);
  const markAllRead = useLedger((state) => state.markAllRead);
  return (
    <div>
      <PageIntro title={tr('Notifications')} subtitle="Budgets, upcoming payments, goals, and the monthly summary." action={notifications.some((item) => !item.read) ? <button type="button" className="btn btn-secondary" onClick={markAllRead}>Mark all read</button> : undefined} />
      {notifications.length === 0 ? <section className="card"><EmptyState title="You're all caught up." body="Folio only notifies you about budgets, recurring payments, goals, and the monthly summary." /></section> : (
        <div className="grid gap-2">
          {notifications.map((item) => (
            <Link key={item.id} to={item.href} className={item.read ? 'card block p-4 opacity-70' : 'card block p-4'} onClick={() => markRead(item.id)}>
              <div className="font-semibold">{tr(item.titleKey)}</div>
              <p className="mt-1 text-sm">{tr(item.messageKey, item.vars)}</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

import { useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { Feedback, Layout } from '@/components/Layout';
import { AccountsPage } from '@/pages/AccountsPage';
import { BudgetsPage } from '@/pages/BudgetsPage';
import { CategoriesPage } from '@/pages/CategoriesPage';
import { GoalsPage } from '@/pages/GoalsPage';
import { PlanPage } from '@/pages/PlanPage';
import { HomePage } from '@/pages/HomePage';
import { LockPage } from '@/pages/LockPage';
import { NotificationsPage } from '@/pages/NotificationsPage';
import { ProfilePage } from '@/pages/ProfilePage';
import { SignInPage } from '@/pages/SignInPage';
import { isFirebaseConfigured } from '@/lib/firebase';
import { RecurringPage } from '@/pages/RecurringPage';
import { ReportsPage } from '@/pages/ReportsPage';
import { TransactionFormPage } from '@/pages/TransactionFormPage';
import { TransactionsPage } from '@/pages/TransactionsPage';
import { useLedger } from '@/store/ledger';

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  return null;
}

export function App() {
  const status = useLedger((state) => state.status);
  const error = useLedger((state) => state.error);
  const authUser = useLedger((state) => state.authUser);
  const authReady = useLedger((state) => state.authReady);
  const init = useLedger((state) => state.init);

  useEffect(() => { void init(); }, [init]);

  if (status === 'loading') {
    return <div className="grid min-h-screen place-items-center"><p className="text-lg font-semibold tracking-tight">Folio</p></div>;
  }
  if (status === 'error') {
    return <div className="grid min-h-screen place-items-center px-6 text-center"><div><h1 className="text-2xl font-semibold">Folio could not open its database</h1><p className="muted mt-2 max-w-md">{error || 'This browser may be blocking storage. Try another window that is not private.'}</p></div></div>;
  }
  if (isFirebaseConfigured() && !authReady) {
    return <div className="grid min-h-screen place-items-center"><p className="text-lg font-semibold tracking-tight">Folio</p></div>;
  }
  if (isFirebaseConfigured() && !authUser) {
    return <><SignInPage /><Feedback /></>;
  }

  return (
    <>
      {status === 'locked' ? <LockPage /> : (
        <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, '') || undefined}>
          <ScrollToTop />
          <Routes>
            <Route element={<Layout />}>
              <Route index element={<HomePage />} />
              <Route path="transactions" element={<TransactionsPage />} />
              <Route path="transactions/new" element={<TransactionFormPage />} />
              <Route path="transactions/:id/edit" element={<TransactionFormPage />} />
              <Route path="budgets" element={<BudgetsPage />} />
              <Route path="reports" element={<ReportsPage />} />
              <Route path="profile" element={<ProfilePage />} />
              <Route path="goals" element={<GoalsPage />} />
              <Route path="plan" element={<PlanPage />} />
              <Route path="accounts" element={<AccountsPage />} />
              <Route path="categories" element={<CategoriesPage />} />
              <Route path="recurring" element={<RecurringPage />} />
              <Route path="notifications" element={<NotificationsPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </BrowserRouter>
      )}
      <Feedback />
    </>
  );
}

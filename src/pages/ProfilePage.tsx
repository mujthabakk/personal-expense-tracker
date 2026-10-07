import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button, Field, PageIntro, Segmented, SelectInput, TextInput } from '@/components/ui';
import { useI18n } from '@/i18n';
import { monthKey, toISODate } from '@/lib/dates';
import { isFirebaseConfigured } from '@/lib/firebase';
import { CURRENCIES, type ThemeMode } from '@/models/types';
import { createBackup, readBackup, type BackupFile } from '@/services/backup';
import { downloadBlob, exportTransactions, monthRange } from '@/services/exportData';
import { transactionsInRange } from '@/services/finance';
import { snapshot } from '@/store/helpers';
import { useLedger } from '@/store/ledger';

export function ProfilePage() {
  const tr = useI18n();
  const settings = useLedger((state) => state.settings);
  const profile = useLedger((state) => state.userProfile);
  const transactions = useLedger((state) => state.transactions);
  const security = useLedger((state) => state.security);
  const authUser = useLedger((state) => state.authUser);
  const syncStatus = useLedger((state) => state.syncStatus);
  const updateSettings = useLedger((state) => state.updateSettings);
  const updateProfile = useLedger((state) => state.updateProfile);
  const enablePin = useLedger((state) => state.enablePin);
  const disablePin = useLedger((state) => state.disablePin);
  const changePin = useLedger((state) => state.changePin);
  const enableBiometric = useLedger((state) => state.enableBiometric);
  const disableBiometric = useLedger((state) => state.disableBiometric);
  const lock = useLedger((state) => state.lock);
  const importFile = useLedger((state) => state.importFile);
  const restoreBackup = useLedger((state) => state.restoreBackup);
  const loadDemo = useLedger((state) => state.loadDemo);
  const eraseAll = useLedger((state) => state.eraseAll);
  const signInEmail = useLedger((state) => state.signInEmail);
  const signUpEmail = useLedger((state) => state.signUpEmail);
  const sendReset = useLedger((state) => state.sendReset);
  const signOutUser = useLedger((state) => state.signOutUser);
  const syncNow = useLedger((state) => state.syncNow);
  const confirm = useLedger((state) => state.confirm);
  const toast = useLedger((state) => state.toast);
  const current = () => snapshot(useLedger.getState());

  const [exportFormat, setExportFormat] = useState<'csv' | 'xlsx' | 'pdf'>('csv');
  const [range, setRange] = useState<'month' | 'all' | 'custom'>('month');
  const [from, setFrom] = useState(monthRange().from);
  const [to, setTo] = useState(monthRange().to);
  const [passphrase, setPassphrase] = useState('');
  const [restorePass, setRestorePass] = useState('');
  const [pin, setPin] = useState('');
  const [pin2, setPin2] = useState('');
  const [currentPin, setCurrentPin] = useState('');
  const [authMode, setAuthMode] = useState<'in' | 'up'>('in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');

  async function downloadExport() {
    const bounds = range === 'all' ? { from: '0000-01-01', to: '9999-12-31' } : range === 'month' ? monthRange() : { from, to };
    const rows = transactionsInRange(transactions, bounds.from, bounds.to);
    await exportTransactions({ format: exportFormat, transactions: rows, state: current(), title: `${bounds.from} to ${bounds.to}` });
  }

  async function onBackup() {
    const file = await createBackup(current(), passphrase);
    downloadBlob(new Blob([JSON.stringify(file)], { type: 'application/json' }), `folio-backup-${toISODate(new Date())}.json`);
    toast(passphrase ? 'Encrypted backup downloaded.' : 'Backup downloaded.');
  }

  async function onRestore(file: File) {
    const parsed = JSON.parse(await file.text()) as BackupFile;
    const data = await readBackup(parsed, restorePass);
    const ok = await confirm({ title: 'Replace data on this device?', message: 'Restoring a backup replaces the ledger currently stored in this browser.', confirmLabel: 'Restore', danger: true });
    if (ok) restoreBackup(data);
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="lg:col-span-2"><PageIntro title={tr('Profile')} subtitle="Preferences stay on this device unless you sign in to sync." /></div>
      <section className="card grid gap-4 p-5">
        <h2 className="font-semibold">Profile</h2>
        <Field label="Name"><TextInput value={profile.name} onChange={(event) => updateProfile({ name: event.target.value })} placeholder="Your name" /></Field>
        <Field label={tr('Currency')}>
          <SelectInput value={settings.currency} onChange={(event) => updateSettings({ currency: event.target.value })}>
            {CURRENCIES.map((item) => <option key={item.code} value={item.code}>{item.label}</option>)}
          </SelectInput>
        </Field>
        <Field label={tr('Language')}>
          <SelectInput value={settings.language} onChange={(event) => updateSettings({ language: event.target.value as 'en' | 'hi' })}>
            <option value="en">English</option>
            <option value="hi">हिन्दी</option>
          </SelectInput>
        </Field>
        <div>
          <div className="label">{tr('Theme')}</div>
          <Segmented label="Theme" value={settings.theme} onChange={(theme: ThemeMode) => updateSettings({ theme })} options={[{ value: 'light', label: tr('Light') }, { value: 'dark', label: tr('Dark') }, { value: 'system', label: tr('System') }]} />
        </div>
      </section>

      <section className="card p-5">
        <h2 className="mb-3 font-semibold">Manage</h2>
        <div className="grid gap-2">
          <Link className="nav-link" to="/categories">{tr('Categories')}</Link>
          <Link className="nav-link" to="/accounts">{tr('Accounts')}</Link>
          <Link className="nav-link" to="/budgets">Budget settings</Link>
          <Link className="nav-link" to="/goals">{tr('Goals')}</Link>
          <Link className="nav-link" to="/recurring">{tr('Recurring')}</Link>
        </div>
        <h3 className="mb-2 mt-6 font-semibold">Notification settings</h3>
        {([
          ['budgetWarning', 'Budget almost exceeded'],
          ['budgetExceeded', 'Budget exceeded'],
          ['recurring', 'Recurring payment coming soon'],
          ['goals', 'Savings goal reminder'],
          ['monthlySummary', 'Monthly financial summary'],
        ] as const).map(([key, label]) => (
          <label key={key} className="flex items-center justify-between gap-3 py-2 text-sm font-medium">
            {label}
            <input type="checkbox" checked={settings.notifications[key]} onChange={(event) => updateSettings({ notifications: { ...settings.notifications, [key]: event.target.checked } })} />
          </label>
        ))}
      </section>

      <section className="card grid gap-3 p-5">
        <h2 className="font-semibold">{tr('Export')}</h2>
        <Segmented label="Export format" value={exportFormat} onChange={setExportFormat} options={[{ value: 'csv', label: 'CSV' }, { value: 'xlsx', label: 'Excel' }, { value: 'pdf', label: 'PDF' }]} />
        <Segmented label="Export range" value={range} onChange={setRange} options={[{ value: 'month', label: 'This month' }, { value: 'all', label: 'All' }, { value: 'custom', label: 'Custom' }]} />
        {range === 'custom' ? <div className="grid grid-cols-2 gap-2"><TextInput type="date" value={from} onChange={(event) => setFrom(event.target.value)} /><TextInput type="date" value={to} onChange={(event) => setTo(event.target.value)} /></div> : null}
        <Button variant="primary" onClick={() => void downloadExport()}>Download</Button>
        <h3 className="mt-4 font-semibold">{tr('Import')}</h3>
        <p className="muted text-sm">CSV or Excel with Date, Type, Amount, Category, Account, Payment method, Description, Notes.</p>
        <input className="text-sm" type="file" accept=".csv,.xlsx,.xls,text/csv" onChange={async (event) => {
          const file = event.target.files?.[0];
          if (!file) return;
          const result = await importFile(file);
          toast(`Imported ${result.imported}. Skipped ${result.skipped}.`);
          event.target.value = '';
        }} />
      </section>

      <section className="card grid gap-3 p-5">
        <h2 className="font-semibold">{tr('Backup')}</h2>
        <Field label="Backup passphrase" hint="Optional. Leave blank for a readable JSON file. A passphrase encrypts the file."><TextInput type="password" value={passphrase} onChange={(event) => setPassphrase(event.target.value)} autoComplete="new-password" /></Field>
        <Button onClick={() => void onBackup()}>Download backup</Button>
        <Field label="Restore passphrase"><TextInput type="password" value={restorePass} onChange={(event) => setRestorePass(event.target.value)} /></Field>
        <input type="file" accept="application/json,.json" onChange={async (event) => {
          const file = event.target.files?.[0];
          if (!file) return;
          try { await onRestore(file); } catch (error) { toast(error instanceof Error ? error.message : 'Could not restore.'); }
          event.target.value = '';
        }} />
        <div className="mt-2 flex flex-wrap gap-2">
          <Button onClick={async () => { if (await confirm({ title: 'Load sample month?', message: 'Adds sample income, expenses, budgets, goals, and recurring payments.', confirmLabel: 'Load sample' })) loadDemo(); }}>{tr('Load sample month')}</Button>
          <Button variant="danger" onClick={async () => { if (await confirm({ title: 'Erase financial records?', message: 'Transactions, budgets, goals, and recurring payments on this device will be deleted. Preferences stay.', confirmLabel: 'Erase', danger: true })) eraseAll(); }}>{tr('Erase data')}</Button>
        </div>
      </section>

      <section className="card grid gap-3 p-5">
        <h2 className="font-semibold">{tr('Security')}</h2>
        <p className="muted text-sm">With app lock on, the ledger is encrypted in this browser with your PIN. Biometrics use this device's authenticator and never replace the PIN. Cloud sync stores data only under your Firebase account. The PIN is never uploaded.</p>
        {security.encryptionEnabled ? (
          <>
            <Field label="Current PIN"><TextInput inputMode="numeric" value={currentPin} onChange={(event) => setCurrentPin(event.target.value.replace(/\D/g, '').slice(0, 6))} /></Field>
            <Field label="New PIN"><TextInput inputMode="numeric" value={pin} onChange={(event) => setPin(event.target.value.replace(/\D/g, '').slice(0, 6))} /></Field>
            <Field label="Confirm PIN"><TextInput inputMode="numeric" value={pin2} onChange={(event) => setPin2(event.target.value.replace(/\D/g, '').slice(0, 6))} /></Field>
            <div className="flex flex-wrap gap-2">
              <Button onClick={async () => setMessage(await changePin(currentPin, pin, pin2) ?? 'PIN updated.')}>Change PIN</Button>
              <Button onClick={async () => setMessage(await disablePin(currentPin) ?? '')}>Turn off</Button>
              <Button onClick={lock}>Lock now</Button>
            </div>
            {security.biometricAvailable ? <Button onClick={async () => setMessage(security.biometricEnabled ? (await disableBiometric(), 'Biometric unlock is off.') : await enableBiometric() ?? '')}>{security.biometricEnabled ? 'Turn off biometrics' : 'Turn on biometrics'}</Button> : <p className="muted text-sm">Biometric unlock is not available in this browser.</p>}
          </>
        ) : (
          <>
            <Field label="PIN"><TextInput inputMode="numeric" value={pin} onChange={(event) => setPin(event.target.value.replace(/\D/g, '').slice(0, 6))} /></Field>
            <Field label="Confirm PIN"><TextInput inputMode="numeric" value={pin2} onChange={(event) => setPin2(event.target.value.replace(/\D/g, '').slice(0, 6))} /></Field>
            <Button variant="primary" onClick={async () => setMessage(await enablePin(pin, pin2) ?? '')}>Turn on app lock</Button>
          </>
        )}
        {message ? <p className="text-sm">{message}</p> : null}
      </section>

      <section className="card grid gap-3 p-5">
        <h2 className="font-semibold">Cloud sync</h2>
        {!isFirebaseConfigured() ? <p className="muted text-sm">Add your Firebase web config to <code>.env.local</code> and restart. Until then, everything stays in this browser. Deploy <code>firestore.rules</code> so each person can only read their own ledger.</p> : authUser ? (
          <>
            <p className="text-sm">Signed in as {authUser.email}</p>
            <p className="muted text-sm">Status: {syncStatus}</p>
            <div className="flex gap-2"><Button onClick={() => void syncNow()}>Sync now</Button><Button onClick={() => void signOutUser()}>{tr('Sign out')}</Button></div>
          </>
        ) : (
          <>
            <Segmented label="Account" value={authMode} onChange={setAuthMode} options={[{ value: 'in', label: tr('Sign in') }, { value: 'up', label: tr('Create account') }]} />
            <Field label="Email"><TextInput type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="username" /></Field>
            <Field label="Password"><TextInput type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete={authMode === 'up' ? 'new-password' : 'current-password'} /></Field>
            <Button variant="primary" onClick={async () => setMessage((authMode === 'in' ? await signInEmail(email, password) : await signUpEmail(email, password)) ?? 'Signed in.')}>{authMode === 'in' ? tr('Sign in') : tr('Create account')}</Button>
            <button type="button" className="text-left text-sm font-semibold" onClick={async () => setMessage(await sendReset(email) ?? 'Password reset email sent.')}>Forgot password</button>
          </>
        )}
      </section>

      <section className="card p-5 lg:col-span-2">
        <h2 className="font-semibold">{tr('About')}</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6">Folio 1.0 is a private expense tracker for the web. Records live in this browser first. A PIN encrypts them at rest. Backups can be encrypted with a passphrase you choose. Firebase sync, when configured, isolates data with <code>users/&#123;uid&#125;</code> and security rules. The web API key is not a secret; the rules are what keep one person's finances away from another.</p>
        <p className="muted mt-3 text-xs">Month key {monthKey(new Date())}. Keyboard shortcut: N for a new transaction.</p>
      </section>
    </div>
  );
}

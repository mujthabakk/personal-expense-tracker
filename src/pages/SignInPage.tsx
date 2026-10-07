import { useState } from 'react';
import { Button, Field, Segmented, TextInput } from '@/components/ui';
import { useI18n } from '@/i18n';
import { useLedger } from '@/store/ledger';

export function SignInPage() {
  const tr = useI18n();
  const signInEmail = useLedger((state) => state.signInEmail);
  const signUpEmail = useLedger((state) => state.signUpEmail);
  const sendReset = useLedger((state) => state.sendReset);
  const [mode, setMode] = useState<'in' | 'up'>('in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    const error = mode === 'in' ? await signInEmail(email, password) : await signUpEmail(email, password);
    setBusy(false);
    setMessage(error ?? '');
  }

  return (
    <div className="grid min-h-screen place-items-center px-4">
      <div className="card w-full max-w-md p-6">
        <div className="mb-5 flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#171b22] text-sm font-semibold text-white">F</span>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Folio</h1>
            <p className="muted text-sm">Sign in to open your ledger.</p>
          </div>
        </div>
        <div className="grid gap-4">
          <Segmented label="Account" value={mode} onChange={setMode} options={[{ value: 'in', label: tr('Sign in') }, { value: 'up', label: tr('Create account') }]} />
          <Field label="Email">
            <TextInput type="email" value={email} autoComplete="username" onChange={(event) => setEmail(event.target.value)} />
          </Field>
          <Field label="Password" hint={mode === 'up' ? 'At least 8 characters.' : undefined}>
            <TextInput type="password" value={password} autoComplete={mode === 'up' ? 'new-password' : 'current-password'} onChange={(event) => setPassword(event.target.value)} />
          </Field>
          {message ? <p className="text-sm text-[var(--danger)]">{message}</p> : null}
          <Button variant="primary" disabled={busy || !email || !password} onClick={() => void submit()}>{busy ? 'Please wait…' : mode === 'in' ? tr('Sign in') : tr('Create account')}</Button>
          <button type="button" className="text-left text-sm font-semibold" onClick={async () => setMessage(await sendReset(email) ?? 'Password reset email sent.')}>Forgot password</button>
        </div>
      </div>
    </div>
  );
}

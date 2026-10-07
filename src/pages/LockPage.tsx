import { useState } from 'react';
import { Button } from '@/components/ui';
import { useLedger } from '@/store/ledger';

export function LockPage() {
  const unlock = useLedger((state) => state.unlock);
  const unlockBiometric = useLedger((state) => state.unlockBiometric);
  const eraseEncrypted = useLedger((state) => state.eraseEncrypted);
  const pinError = useLedger((state) => state.pinError);
  const security = useLedger((state) => state.security);
  const confirm = useLedger((state) => state.confirm);
  const [pin, setPin] = useState('');
  const [shake, setShake] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(value = pin) {
    if (value.length < 4) return;
    setBusy(true);
    const ok = await unlock(value);
    setBusy(false);
    if (!ok) {
      setShake(true);
      setPin('');
      window.setTimeout(() => setShake(false), 350);
    }
  }

  function press(digit: string) {
    const next = (pin + digit).slice(0, 6);
    setPin(next);
    if (next.length === 6) void submit(next);
  }

  return (
    <div className="grid min-h-screen place-items-center px-4">
      <div className="w-full max-w-sm text-center">
        <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-[#171b22] text-white">F</div>
        <h1 className="text-2xl font-semibold">Folio is locked</h1>
        <p className="muted mt-2 text-sm">Enter your PIN. Your ledger stays encrypted until you do.</p>
        <div className={`mt-6 flex justify-center gap-2 ${shake ? 'shake' : ''}`} aria-hidden="true">
          {Array.from({ length: Math.max(4, pin.length) }, (_, index) => <span key={index} className="h-3 w-3 rounded-full border border-[var(--ink)]" style={{ background: index < pin.length ? 'var(--ink)' : 'transparent' }} />)}
        </div>
        <input className="sr-only" inputMode="numeric" autoComplete="one-time-code" value={pin} aria-label="PIN" onChange={(event) => setPin(event.target.value.replace(/\D/g, '').slice(0, 6))} />
        <div className="mx-auto mt-6 grid w-64 grid-cols-3 gap-2">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'].map((digit) => digit ? (
            <button key={digit} type="button" className="btn btn-secondary h-14" onClick={() => digit === '⌫' ? setPin((value) => value.slice(0, -1)) : press(digit)}>{digit}</button>
          ) : <span key="gap" />)}
        </div>
        {pinError ? <p className="mt-4 text-sm text-[var(--danger)]">{pinError}</p> : null}
        <div className="mt-4 flex flex-col items-center gap-2">
          <Button variant="primary" disabled={busy || pin.length < 4} onClick={() => void submit()}>{busy ? 'Unlocking…' : 'Unlock'}</Button>
          {security.biometricEnabled ? <Button onClick={() => void unlockBiometric()}>Use biometrics</Button> : null}
          <button type="button" className="mt-6 text-sm text-[var(--danger)]" onClick={async () => {
            const ok = await confirm({ title: 'Erase encrypted data?', message: 'If you forgot the PIN, Folio cannot recover this ledger. This permanently deletes it from this browser.', confirmLabel: 'Erase everything', danger: true });
            if (ok) await eraseEncrypted();
          }}>Forgot PIN? Erase this device's data</button>
        </div>
      </div>
    </div>
  );
}

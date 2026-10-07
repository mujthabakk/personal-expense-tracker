import { openDB, type IDBPDatabase } from 'idb';
import { createInitialState } from '@/data/defaults';
import { enrollBiometric, supportsBiometric, unlockBiometricSecret, unwrapVaultKey } from '@/lib/biometric';
import {
  PIN_ITERATIONS,
  PinError,
  base64ToBytes,
  bytesToBase64,
  createVerifier,
  decryptJson,
  derivePinKey,
  encryptJson,
  exportRawKey,
  matchesVerifier,
  randomBytes,
} from '@/lib/crypto';
import type { PersistedState, SecurityMeta, Transaction } from '@/models/types';

interface VaultRecord {
  id: 'data';
  iv: string;
  ciphertext: string;
}

interface FolioDB {
  transactions: { key: string; value: Transaction; indexes: { 'by-date': string; 'by-category': string; 'by-account': string; 'by-type': string } };
  categories: { key: string; value: PersistedState['categories'][number] };
  accounts: { key: string; value: PersistedState['accounts'][number] };
  budgets: { key: string; value: PersistedState['budgets'][number] };
  goals: { key: string; value: PersistedState['goals'][number] };
  recurring: { key: string; value: PersistedState['recurring'][number] };
  notifications: { key: string; value: PersistedState['notifications'][number] };
  tombstones: { key: string; value: PersistedState['tombstones'][number] };
  settings: { key: string; value: PersistedState['settings'] };
  profile: { key: string; value: PersistedState['userProfile'] };
  meta: { key: string; value: SecurityMeta };
  vault: { key: string; value: VaultRecord };
}

const PLAIN_STORES = [
  'transactions',
  'categories',
  'accounts',
  'budgets',
  'goals',
  'recurring',
  'notifications',
  'tombstones',
  'settings',
  'profile',
] as const;

let databasePromise: Promise<IDBPDatabase<FolioDB>> | null = null;
let sessionKey: CryptoKey | null = null;

function freshMeta(): SecurityMeta {
  return {
    id: 'meta',
    initialized: true,
    encryptionEnabled: false,
    salt: '',
    verifierIv: '',
    verifier: '',
    iterations: PIN_ITERATIONS,
    failedAttempts: 0,
    lockUntil: 0,
    biometricEnabled: false,
    biometricCredentialId: '',
    biometricWrapped: '',
    biometricWrapIv: '',
  };
}

async function getDb(): Promise<IDBPDatabase<FolioDB>> {
  if (!databasePromise) {
    databasePromise = openDB<FolioDB>('folio', 1, {
      upgrade(db) {
        const transactions = db.createObjectStore('transactions', { keyPath: 'id' });
        transactions.createIndex('by-date', 'date');
        transactions.createIndex('by-category', 'categoryId');
        transactions.createIndex('by-account', 'accountId');
        transactions.createIndex('by-type', 'type');
        db.createObjectStore('categories', { keyPath: 'id' });
        db.createObjectStore('accounts', { keyPath: 'id' });
        db.createObjectStore('budgets', { keyPath: 'id' });
        db.createObjectStore('goals', { keyPath: 'id' });
        db.createObjectStore('recurring', { keyPath: 'id' });
        db.createObjectStore('notifications', { keyPath: 'id' });
        db.createObjectStore('tombstones', { keyPath: 'id' });
        db.createObjectStore('settings', { keyPath: 'id' });
        db.createObjectStore('profile', { keyPath: 'id' });
        db.createObjectStore('meta', { keyPath: 'id' });
        db.createObjectStore('vault', { keyPath: 'id' });
      },
    });
  }
  return databasePromise;
}

async function readPlain(): Promise<PersistedState> {
  const db = await getDb();
  const fallback = createInitialState();
  const [transactions, categories, accounts, budgets, goals, recurring, notifications, tombstones, settings, profile] = await Promise.all([
    db.getAllFromIndex('transactions', 'by-date'),
    db.getAll('categories'),
    db.getAll('accounts'),
    db.getAll('budgets'),
    db.getAll('goals'),
    db.getAll('recurring'),
    db.getAll('notifications'),
    db.getAll('tombstones'),
    db.get('settings', 'settings'),
    db.get('profile', 'profile'),
  ]);
  return {
    version: 1,
    transactions,
    categories: categories.length ? categories : fallback.categories,
    accounts: accounts.length ? accounts : fallback.accounts,
    budgets,
    goals,
    recurring,
    notifications,
    tombstones,
    settings: settings ?? fallback.settings,
    userProfile: profile ?? fallback.userProfile,
  };
}

async function savePlain(data: PersistedState): Promise<void> {
  const db = await getDb();
  const tx = db.transaction([...PLAIN_STORES, 'vault'], 'readwrite');
  for (const store of PLAIN_STORES) tx.objectStore(store).clear();
  for (const item of data.transactions) tx.objectStore('transactions').put(item);
  for (const item of data.categories) tx.objectStore('categories').put(item);
  for (const item of data.accounts) tx.objectStore('accounts').put(item);
  for (const item of data.budgets) tx.objectStore('budgets').put(item);
  for (const item of data.goals) tx.objectStore('goals').put(item);
  for (const item of data.recurring) tx.objectStore('recurring').put(item);
  for (const item of data.notifications) tx.objectStore('notifications').put(item);
  for (const item of data.tombstones) tx.objectStore('tombstones').put(item);
  tx.objectStore('settings').put(data.settings);
  tx.objectStore('profile').put(data.userProfile);
  tx.objectStore('vault').delete('data');
  await tx.done;
}

async function saveEncrypted(data: PersistedState, key: CryptoKey): Promise<void> {
  const payload = await encryptJson(key, data);
  const db = await getDb();
  const tx = db.transaction([...PLAIN_STORES, 'vault'], 'readwrite');
  tx.objectStore('vault').put({ id: 'data', iv: payload.iv, ciphertext: payload.ciphertext });
  for (const store of PLAIN_STORES) tx.objectStore(store).clear();
  await tx.done;
}

async function readMeta(): Promise<SecurityMeta> {
  const db = await getDb();
  return (await db.get('meta', 'meta')) ?? freshMeta();
}

async function writeMeta(meta: SecurityMeta): Promise<void> {
  const db = await getDb();
  await db.put('meta', meta);
}

function assertPinAvailable(meta: SecurityMeta) {
  if (meta.lockUntil && meta.lockUntil > Date.now()) {
    const seconds = Math.ceil((meta.lockUntil - Date.now()) / 1000);
    throw new PinError(`Too many attempts. Try again in ${seconds}s.`, 'locked');
  }
}

async function recordFailure(meta: SecurityMeta): Promise<void> {
  const failedAttempts = meta.failedAttempts + 1;
  await writeMeta({
    ...meta,
    failedAttempts,
    lockUntil: failedAttempts >= 5 ? Date.now() + 30_000 : 0,
  });
}

export const repository = {
  async load(): Promise<{ status: 'ready'; data: PersistedState } | { status: 'locked' }> {
    const db = await getDb();
    const meta = await db.get('meta', 'meta');
    if (!meta?.initialized) {
      const initial = createInitialState();
      await savePlain(initial);
      await writeMeta(freshMeta());
      return { status: 'ready', data: initial };
    }
    if (meta.encryptionEnabled) return { status: 'locked' };
    return { status: 'ready', data: await readPlain() };
  },

  async save(data: PersistedState): Promise<void> {
    if (sessionKey) {
      await saveEncrypted(data, sessionKey);
      return;
    }
    const meta = await readMeta();
    if (meta.encryptionEnabled) throw new Error('Unlock Folio before saving.');
    await savePlain(data);
  },

  async securityStatus() {
    const meta = await readMeta();
    return {
      encryptionEnabled: meta.encryptionEnabled,
      biometricEnabled: meta.biometricEnabled,
      failedAttempts: meta.failedAttempts,
      lockUntil: meta.lockUntil,
      biometricAvailable: await supportsBiometric(),
    };
  },

  async enableEncryption(pin: string, data: PersistedState): Promise<void> {
    if (!/^\d{4,6}$/.test(pin)) throw new PinError('Use a 4 to 6 digit PIN.', 'invalid');
    const salt = randomBytes(16);
    const key = await derivePinKey(pin, salt, PIN_ITERATIONS);
    const verifier = await createVerifier(key);
    sessionKey = key;
    await saveEncrypted(data, key);
    await writeMeta({
      ...freshMeta(),
      encryptionEnabled: true,
      salt: bytesToBase64(salt),
      verifierIv: verifier.iv,
      verifier: verifier.ciphertext,
      iterations: PIN_ITERATIONS,
    });
  },

  async unlock(pin: string): Promise<PersistedState> {
    const meta = await readMeta();
    if (!meta.encryptionEnabled) throw new PinError('App lock is off.', 'invalid');
    assertPinAvailable(meta);
    const key = await derivePinKey(pin, base64ToBytes(meta.salt), meta.iterations || PIN_ITERATIONS);
    const valid = await matchesVerifier(key, meta.verifierIv, meta.verifier);
    if (!valid) {
      await recordFailure(meta);
      throw new PinError('Incorrect PIN.', 'invalid');
    }
    const db = await getDb();
    const vault = await db.get('vault', 'data');
    if (!vault) throw new Error('Encrypted ledger is missing.');
    const data = await decryptJson<PersistedState>(key, vault.iv, vault.ciphertext);
    sessionKey = key;
    await writeMeta({ ...meta, failedAttempts: 0, lockUntil: 0 });
    return data;
  },

  async unlockWithBiometric(): Promise<PersistedState> {
    const meta = await readMeta();
    if (!meta.biometricEnabled || !meta.biometricCredentialId) throw new Error('Biometric unlock is not set up.');
    const secret = await unlockBiometricSecret(meta.biometricCredentialId);
    const key = await unwrapVaultKey(secret, meta.biometricWrapIv, meta.biometricWrapped);
    const valid = await matchesVerifier(key, meta.verifierIv, meta.verifier);
    if (!valid) throw new Error('Biometric key did not match this ledger. Use your PIN.');
    const db = await getDb();
    const vault = await db.get('vault', 'data');
    if (!vault) throw new Error('Encrypted ledger is missing.');
    const data = await decryptJson<PersistedState>(key, vault.iv, vault.ciphertext);
    sessionKey = key;
    return data;
  },

  async enableBiometric(): Promise<void> {
    if (!sessionKey) throw new Error('Unlock with your PIN first.');
    const raw = await exportRawKey(sessionKey);
    try {
      const enrolled = await enrollBiometric(raw);
      const meta = await readMeta();
      await writeMeta({
        ...meta,
        biometricEnabled: true,
        biometricCredentialId: enrolled.credentialId,
        biometricWrapped: enrolled.ciphertext,
        biometricWrapIv: enrolled.iv,
      });
    } finally {
      raw.fill(0);
    }
  },

  async disableBiometric(): Promise<void> {
    const meta = await readMeta();
    await writeMeta({
      ...meta,
      biometricEnabled: false,
      biometricCredentialId: '',
      biometricWrapped: '',
      biometricWrapIv: '',
    });
  },

  async disableEncryption(data: PersistedState): Promise<void> {
    sessionKey = null;
    await savePlain(data);
    await writeMeta(freshMeta());
  },

  async changePin(currentPin: string, nextPin: string, data: PersistedState): Promise<void> {
    if (!/^\d{4,6}$/.test(nextPin)) throw new PinError('Use a 4 to 6 digit PIN.', 'invalid');
    const meta = await readMeta();
    const currentKey = await derivePinKey(currentPin, base64ToBytes(meta.salt), meta.iterations || PIN_ITERATIONS);
    const valid = await matchesVerifier(currentKey, meta.verifierIv, meta.verifier);
    if (!valid) throw new PinError('Current PIN is incorrect.', 'invalid');
    const salt = randomBytes(16);
    const key = await derivePinKey(nextPin, salt, PIN_ITERATIONS);
    const verifier = await createVerifier(key);
    sessionKey = key;
    await saveEncrypted(data, key);
    await writeMeta({
      ...meta,
      salt: bytesToBase64(salt),
      verifierIv: verifier.iv,
      verifier: verifier.ciphertext,
      iterations: PIN_ITERATIONS,
      failedAttempts: 0,
      lockUntil: 0,
      biometricEnabled: false,
      biometricCredentialId: '',
      biometricWrapped: '',
      biometricWrapIv: '',
    });
  },

  lock() {
    sessionKey = null;
  },

  async eraseVault(): Promise<PersistedState> {
    sessionKey = null;
    const fresh = createInitialState();
    await savePlain(fresh);
    await writeMeta(freshMeta());
    return fresh;
  },

  async transactionsInRange(from: string, to: string): Promise<Transaction[]> {
    const meta = await readMeta();
    if (meta.encryptionEnabled) return [];
    const db = await getDb();
    const range = IDBKeyRange.bound(from, `${to}\uffff`);
    return db.getAllFromIndex('transactions', 'by-date', range);
  },
};

export type LoadResult = Awaited<ReturnType<typeof repository.load>>;

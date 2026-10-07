import { CATEGORY_COLORS } from '@/models/types';
import type { PaymentMethod, PersistedState, TransactionType } from '@/models/types';
import { makeId, nowIso } from '@/lib/id';
import { bytesToBase64, decryptJson, derivePinKey, encryptJson, randomBytes } from '@/lib/crypto';
import { base64ToBytes } from '@/lib/crypto';
import { parseCsv } from '@/services/exportData';
import { roundMoney } from '@/lib/money';
import { combineDate } from '@/lib/dates';

const PAYMENTS = new Set(['cash', 'bank', 'upi', 'credit_card', 'debit_card', 'wallet', 'other']);

export interface ImportResult {
  state: PersistedState;
  imported: number;
  skipped: number;
}

export function importCsvText(text: string, state: PersistedState): ImportResult {
  const rows = parseCsv(text);
  if (!rows.length) return { state, imported: 0, skipped: 0 };
  const header = rows[0].map((cell) => cell.trim().toLowerCase());
  const records = rows.slice(1).map((row) => Object.fromEntries(header.map((key, index) => [key, row[index] ?? ''])));
  return importRecords(records, state);
}

export function importRecords(records: Array<Record<string, string | number>>, state: PersistedState): ImportResult {
  const next: PersistedState = {
    ...state,
    transactions: [...state.transactions],
    categories: [...state.categories],
    accounts: [...state.accounts],
  };
  let imported = 0;
  let skipped = 0;
  for (const record of records) {
    const normalized = Object.fromEntries(Object.entries(record).map(([key, value]) => [key.toLowerCase().trim(), String(value ?? '').trim()]));
    const amount = Number(String(normalized.amount ?? '').replace(/,/g, ''));
    const date = (normalized.date || '').slice(0, 10);
    const type = (normalized.type || 'expense').toLowerCase() as TransactionType;
    if (!Number.isFinite(amount) || amount <= 0 || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !['expense', 'income', 'transfer'].includes(type)) {
      skipped += 1;
      continue;
    }
    const categoryName = normalized.category || (type === 'transfer' ? '' : 'Other');
    const accountName = normalized.account || 'Cash';
    const categoryId = categoryName ? ensureCategory(next, categoryName, type === 'income' ? 'income' : 'expense') : '';
    const accountId = ensureAccount(next, accountName);
    const payment = normalized['payment method'] || normalized.paymentmethod || normalized.method || 'other';
    const paymentMethod = (PAYMENTS.has(payment) ? payment : 'other') as PaymentMethod;
    const stamp = nowIso();
    next.transactions.push({
      id: makeId(),
      type,
      amount: roundMoney(amount),
      categoryId,
      accountId,
      toAccountId: '',
      paymentMethod,
      description: normalized.description || '',
      notes: normalized.notes || '',
      date: combineDate(date),
      createdAt: stamp,
      updatedAt: stamp,
      recurringTransactionId: '',
    });
    imported += 1;
  }
  return { state: next, imported, skipped };
}

function ensureCategory(state: PersistedState, name: string, type: 'expense' | 'income'): string {
  const found = state.categories.find((item) => item.name.toLowerCase() === name.toLowerCase() && (type === 'expense' ? item.type === 'expense' : item.type === 'income'));
  if (found) return found.id;
  const fallback = state.categories.find((item) => item.type === type && item.name === 'Other');
  if (fallback && name.toLowerCase() === 'other') return fallback.id;
  const stamp = nowIso();
  const id = makeId();
  state.categories.push({
    id,
    name,
    type,
    icon: 'circle',
    color: CATEGORY_COLORS[state.categories.length % CATEGORY_COLORS.length],
    budgetAmount: 0,
    isDefault: false,
    createdAt: stamp,
    updatedAt: stamp,
  });
  return id;
}

function ensureAccount(state: PersistedState, name: string): string {
  const found = state.accounts.find((item) => item.name.toLowerCase() === name.toLowerCase());
  if (found) return found.id;
  const stamp = nowIso();
  const id = makeId();
  state.accounts.push({
    id,
    name,
    type: 'custom',
    openingBalance: 0,
    institution: '',
    color: '#334155',
    icon: 'wallet',
    isDefault: false,
    createdAt: stamp,
    updatedAt: stamp,
  });
  return id;
}

export interface BackupFile {
  app: 'folio';
  version: 1;
  exportedAt: string;
  encrypted: boolean;
  salt?: string;
  iv?: string;
  ciphertext?: string;
  data?: PersistedState;
}

export async function createBackup(data: PersistedState, passphrase = ''): Promise<BackupFile> {
  const exportedAt = nowIso();
  if (!passphrase) return { app: 'folio', version: 1, exportedAt, encrypted: false, data };
  const salt = randomBytes(16);
  const key = await derivePinKey(passphrase, salt, 120_000);
  const encrypted = await encryptJson(key, data);
  return {
    app: 'folio',
    version: 1,
    exportedAt,
    encrypted: true,
    salt: bytesToBase64(salt),
    iv: encrypted.iv,
    ciphertext: encrypted.ciphertext,
  };
}

export async function readBackup(file: BackupFile, passphrase = ''): Promise<PersistedState> {
  if (file.app !== 'folio' || file.version !== 1) throw new Error('This file is not a Folio backup.');
  if (!file.encrypted) {
    if (!file.data) throw new Error('Backup file is empty.');
    return file.data;
  }
  if (!passphrase || !file.salt || !file.iv || !file.ciphertext) throw new Error('Enter the backup passphrase.');
  const key = await derivePinKey(passphrase, base64ToBytes(file.salt), 120_000);
  try {
    return await decryptJson<PersistedState>(key, file.iv, file.ciphertext);
  } catch {
    throw new Error('Could not open this backup. Check the passphrase.');
  }
}

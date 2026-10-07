import { create } from 'zustand';
import { applyDemo } from '@/data/demo';
import { createInitialState } from '@/data/defaults';
import { repository } from '@/db/database';
import { PinError } from '@/lib/crypto';
import { authErrorMessage, isFirebaseConfigured, logOut, resetPassword, signIn, signUp, watchAuth } from '@/lib/firebase';
import { makeId, nowIso } from '@/lib/id';
import { applyLanguage, applyTheme } from '@/lib/theme';
import type { Account, AppNotification, Budget, Category, PersistedState, RecurringRule, SavingsGoal, Settings, Transaction, UserProfile } from '@/models/types';
import { importCsvText, importRecords, type ImportResult } from '@/services/backup';
import { buildNotifications } from '@/services/notifications';
import { advanceDate, materializeRecurring } from '@/services/recurring';
import { dropImmediateTwins } from '@/services/finance';
import { syncState } from '@/services/sync';
import { normalizeAmount, validateAccount, validateBudget, validateCategory, validateGoal, validateTransaction } from '@/services/validators';
import { addTombstone, clearTombstone, remember, snapshot } from '@/store/helpers';

export interface ToastItem { id: string; message: string }
export interface DialogState {
  title: string;
  message: string;
  confirmLabel: string;
  danger: boolean;
  resolve: (value: boolean) => void;
}
export interface AuthUser { uid: string; email: string }
export interface SecurityState {
  encryptionEnabled: boolean;
  biometricEnabled: boolean;
  failedAttempts: number;
  lockUntil: number;
  biometricAvailable: boolean;
}

export type TransactionDraft = Omit<Transaction, 'id' | 'createdAt' | 'updatedAt' | 'recurringTransactionId'> & { id?: string; recurringTransactionId?: string };
export type CategoryDraft = Omit<Category, 'id' | 'createdAt' | 'updatedAt' | 'isDefault'> & { id?: string };
export type AccountDraft = Omit<Account, 'id' | 'createdAt' | 'updatedAt' | 'isDefault'> & { id?: string };
export type BudgetDraft = Omit<Budget, 'id' | 'createdAt' | 'updatedAt'> & { id?: string; everyMonth?: boolean };
export type GoalDraft = Omit<SavingsGoal, 'id' | 'createdAt' | 'updatedAt' | 'contributions' | 'currentAmount'> & { id?: string; currentAmount: number };
export type RecurringDraft = Omit<RecurringRule, 'id' | 'createdAt' | 'updatedAt'> & { id?: string };

type SyncStatus = 'local' | 'syncing' | 'synced' | 'offline' | 'error';

interface LedgerStore extends PersistedState {
  status: 'loading' | 'ready' | 'locked' | 'error';
  error: string;
  pinError: string;
  authUser: AuthUser | null;
  authReady: boolean;
  syncStatus: SyncStatus;
  online: boolean;
  toasts: ToastItem[];
  dialog: DialogState | null;
  security: SecurityState;
  init: () => Promise<void>;
  unlock: (pin: string) => Promise<boolean>;
  unlockBiometric: () => Promise<boolean>;
  lock: () => void;
  enablePin: (pin: string, confirmPin: string) => Promise<string | null>;
  changePin: (current: string, next: string, confirmPin: string) => Promise<string | null>;
  disablePin: (pin: string) => Promise<string | null>;
  enableBiometric: () => Promise<string | null>;
  disableBiometric: () => Promise<void>;
  eraseEncrypted: () => Promise<void>;
  saveTransaction: (input: TransactionDraft) => string | null;
  deleteTransaction: (id: string) => void;
  quickAdd: (amount: number, categoryId: string) => void;
  saveCategory: (input: CategoryDraft) => string | null;
  deleteCategory: (id: string, reassignId: string) => string | null;
  saveAccount: (input: AccountDraft) => string | null;
  deleteAccount: (id: string, reassignId: string) => string | null;
  saveBudget: (input: BudgetDraft) => string | null;
  deleteBudget: (id: string) => void;
  saveGoal: (input: GoalDraft) => string | null;
  deleteGoal: (id: string) => void;
  addContribution: (goalId: string, amount: number, date: string, note: string) => string | null;
  saveRecurring: (input: RecurringDraft) => string | null;
  deleteRecurring: (id: string) => void;
  skipRecurring: (id: string) => void;
  markRead: (id: string) => void;
  markAllRead: () => void;
  updateSettings: (patch: Partial<Settings>) => void;
  updateProfile: (patch: Partial<UserProfile>) => void;
  importFile: (file: File) => Promise<ImportResult>;
  restoreBackup: (data: PersistedState) => void;
  loadDemo: () => void;
  eraseAll: () => void;
  signInEmail: (email: string, password: string) => Promise<string | null>;
  signUpEmail: (email: string, password: string) => Promise<string | null>;
  sendReset: (email: string) => Promise<string | null>;
  signOutUser: () => Promise<void>;
  syncNow: () => Promise<void>;
  toast: (message: string) => void;
  dismissToast: (id: string) => void;
  confirm: (options: { title: string; message: string; confirmLabel?: string; danger?: boolean }) => Promise<boolean>;
  closeDialog: (value: boolean) => void;
}

const emptySecurity: SecurityState = {
  encryptionEnabled: false,
  biometricEnabled: false,
  failedAttempts: 0,
  lockUntil: 0,
  biometricAvailable: false,
};

let started = false;
let pending: PersistedState | null = null;
let writing = false;
let syncing = false;
let suppressSync = false;
let syncTimer = 0;

function queueSave(data: PersistedState) {
  pending = data;
  if (!writing) void flush();
}

async function flush() {
  writing = true;
  while (pending) {
    const next = pending;
    pending = null;
    try {
      await repository.save(next);
    } catch (error) {
      console.error('Save failed');
      useLedger.getState().toast(error instanceof Error ? error.message : 'Could not save changes.');
      break;
    }
  }
  writing = false;
  if (pending) void flush();
}

function scheduleSync() {
  if (suppressSync || typeof window === 'undefined') return;
  window.clearTimeout(syncTimer);
  syncTimer = window.setTimeout(() => void useLedger.getState().syncNow(), 1200);
}

function prepare(data: PersistedState): PersistedState {
  const materialized = materializeRecurring(data);
  const twins = dropImmediateTwins(materialized.transactions);
  const tombstones = twins.removedIds.reduce((list, id) => addTombstone(list, 'transactions', id), materialized.tombstones);
  const cleaned = twins.removedIds.length ? { ...materialized, transactions: twins.kept, tombstones } : materialized;
  return { ...cleaned, notifications: buildNotifications(cleaned, cleaned.notifications) };
}

const seed = createInitialState();

export const useLedger = create<LedgerStore>((set, get) => {
  const publish = (data: PersistedState) => {
    const next = prepare(data);
    set(next);
    queueSave(next);
    scheduleSync();
  };

  return {
    ...seed,
    status: 'loading',
    error: '',
    pinError: '',
    authUser: null,
    authReady: false,
    syncStatus: 'local',
    online: typeof navigator === 'undefined' ? true : navigator.onLine,
    toasts: [],
    dialog: null,
    security: emptySecurity,

    async init() {
      if (started) return;
      started = true;
      try {
        const loaded = await repository.load();
        const security = await repository.securityStatus();
        if (loaded.status === 'locked') {
          set({ status: 'locked', security, transactions: [], goals: [], budgets: [], recurring: [] });
        } else {
          const next = prepare(loaded.data);
          applyTheme(next.settings.theme);
          applyLanguage(next.settings.language);
          set({ ...next, status: 'ready', security, syncStatus: navigator.onLine ? 'local' : 'offline' });
          const recurringChanged = next.recurring.some((rule, index) => rule.nextDate !== loaded.data.recurring[index]?.nextDate);
          if (next.transactions.length !== loaded.data.transactions.length || recurringChanged || next.notifications !== loaded.data.notifications) queueSave(next);
        }
      } catch (error) {
        console.error('Database failed');
        set({ status: 'error', error: error instanceof Error ? error.message : 'Database unavailable' });
        return;
      }

      if (!isFirebaseConfigured()) {
        set({ authReady: true });
      } else {
        watchAuth((user) => {
          const email = user?.email ?? '';
          set({ authUser: user ? { uid: user.uid, email } : null, authReady: true });
          if (user && get().status === 'ready') {
            if (email && !get().userProfile.email) get().updateProfile({ email });
            void get().syncNow();
          }
        });
      }
      window.addEventListener('online', () => {
        set({ online: true });
        void get().syncNow();
      });
      window.addEventListener('offline', () => set({ online: false, syncStatus: 'offline' }));
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') void flush();
      });
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
        if (get().settings.theme === 'system') applyTheme('system');
      });
    },

    async unlock(pin) {
      try {
        const data = prepare(await repository.unlock(pin));
        applyTheme(data.settings.theme);
        applyLanguage(data.settings.language);
        set({ ...data, status: 'ready', pinError: '', security: await repository.securityStatus() });
        return true;
      } catch (error) {
        set({ pinError: error instanceof Error ? error.message : 'Incorrect PIN.', security: await repository.securityStatus() });
        return false;
      }
    },

    async unlockBiometric() {
      try {
        const data = prepare(await repository.unlockWithBiometric());
        applyTheme(data.settings.theme);
        applyLanguage(data.settings.language);
        set({ ...data, status: 'ready', pinError: '', security: await repository.securityStatus() });
        return true;
      } catch (error) {
        set({ pinError: error instanceof Error ? error.message : 'Biometric unlock failed.' });
        return false;
      }
    },

    lock() {
      repository.lock();
      set({ ...createInitialState(), transactions: [], status: 'locked', pinError: '', toasts: [], dialog: null });
    },

    async enablePin(pin, confirmPin) {
      if (pin !== confirmPin) return 'PINs do not match.';
      try {
        await repository.enableEncryption(pin, snapshot(get()));
        set({ security: await repository.securityStatus() });
        get().toast('App lock is on.');
        return null;
      } catch (error) {
        return error instanceof Error ? error.message : 'Could not enable app lock.';
      }
    },

    async changePin(current, next, confirmPin) {
      if (next !== confirmPin) return 'PINs do not match.';
      try {
        await repository.changePin(current, next, snapshot(get()));
        set({ security: await repository.securityStatus() });
        get().toast('PIN updated. Turn biometric unlock on again if you use it.');
        return null;
      } catch (error) {
        return error instanceof Error ? error.message : 'Could not change PIN.';
      }
    },

    async disablePin(pin) {
      try {
        await repository.unlock(pin);
        await repository.disableEncryption(snapshot(get()));
        set({ security: await repository.securityStatus() });
        get().toast('App lock is off.');
        return null;
      } catch (error) {
        return error instanceof PinError ? error.message : 'Could not turn off app lock.';
      }
    },

    async enableBiometric() {
      try {
        await repository.enableBiometric();
        set({ security: await repository.securityStatus() });
        get().toast('Biometric unlock is on.');
        return null;
      } catch (error) {
        return error instanceof Error ? error.message : 'Biometric setup failed.';
      }
    },

    async disableBiometric() {
      await repository.disableBiometric();
      set({ security: await repository.securityStatus() });
    },

    async eraseEncrypted() {
      const fresh = await repository.eraseVault();
      applyTheme(fresh.settings.theme);
      set({ ...fresh, status: 'ready', pinError: '', security: await repository.securityStatus() });
    },

    saveTransaction(input) {
      const error = validateTransaction(input, get());
      if (error) return error;
      const stamp = nowIso();
      const existing = input.id ? get().transactions.find((item) => item.id === input.id) : undefined;
      const transaction: Transaction = {
        ...input,
        id: existing?.id ?? makeId(),
        amount: normalizeAmount(input.amount),
        description: input.description.trim(),
        notes: input.notes.trim(),
        recurringTransactionId: existing?.recurringTransactionId || input.recurringTransactionId || '',
        createdAt: existing?.createdAt ?? stamp,
        updatedAt: stamp,
      };
      const transactions = existing
        ? get().transactions.map((item) => (item.id === transaction.id ? transaction : item))
        : [transaction, ...get().transactions];
      publish({
        ...snapshot(get()),
        transactions,
        tombstones: clearTombstone(get().tombstones, 'transactions', transaction.id),
        settings: remember(get().settings, transaction.categoryId, transaction.paymentMethod, transaction.accountId),
      });
      return null;
    },

    deleteTransaction(id) {
      publish({
        ...snapshot(get()),
        transactions: get().transactions.filter((item) => item.id !== id),
        tombstones: addTombstone(get().tombstones, 'transactions', id),
      });
    },

    quickAdd(amount, categoryId) {
      const accountId = get().settings.lastAccountId || get().accounts[0]?.id || '';
      const error = get().saveTransaction({
        type: 'expense',
        amount,
        categoryId,
        accountId,
        toAccountId: '',
        paymentMethod: get().settings.lastPaymentMethod,
        description: '',
        notes: '',
        date: new Date().toISOString(),
      });
      if (error) get().toast(error);
      else get().toast('Expense added.');
    },

    saveCategory(input) {
      const error = validateCategory(input.name, input.budgetAmount);
      if (error) return error;
      const stamp = nowIso();
      const existing = input.id ? get().categories.find((item) => item.id === input.id) : undefined;
      const category: Category = {
        ...input,
        id: existing?.id ?? makeId(),
        name: input.name.trim(),
        budgetAmount: normalizeAmount(input.budgetAmount),
        isDefault: existing?.isDefault ?? false,
        createdAt: existing?.createdAt ?? stamp,
        updatedAt: stamp,
      };
      const categories = existing ? get().categories.map((item) => (item.id === category.id ? category : item)) : [...get().categories, category];
      publish({ ...snapshot(get()), categories, tombstones: clearTombstone(get().tombstones, 'categories', category.id) });
      return null;
    },

    deleteCategory(id, reassignId) {
      const used = get().transactions.some((item) => item.categoryId === id) || get().recurring.some((item) => item.categoryId === id);
      if (used && (!reassignId || reassignId === id)) return 'Choose a category to reassign these records.';
      const stamp = nowIso();
      publish({
        ...snapshot(get()),
        categories: get().categories.filter((item) => item.id !== id),
        transactions: get().transactions.map((item) => (item.categoryId === id ? { ...item, categoryId: reassignId, updatedAt: stamp } : item)),
        recurring: get().recurring.map((item) => (item.categoryId === id ? { ...item, categoryId: reassignId, updatedAt: stamp } : item)),
        budgets: get().budgets.map((item) => (item.categoryId === id ? { ...item, categoryId: reassignId, updatedAt: stamp } : item)),
        tombstones: addTombstone(get().tombstones, 'categories', id),
      });
      return null;
    },

    saveAccount(input) {
      const error = validateAccount(input.name, input.openingBalance);
      if (error) return error;
      const stamp = nowIso();
      const existing = input.id ? get().accounts.find((item) => item.id === input.id) : undefined;
      const account: Account = {
        ...input,
        id: existing?.id ?? makeId(),
        name: input.name.trim(),
        institution: input.institution.trim(),
        openingBalance: normalizeAmount(input.openingBalance),
        isDefault: existing?.isDefault ?? false,
        createdAt: existing?.createdAt ?? stamp,
        updatedAt: stamp,
      };
      const accounts = existing ? get().accounts.map((item) => (item.id === account.id ? account : item)) : [...get().accounts, account];
      publish({ ...snapshot(get()), accounts, tombstones: clearTombstone(get().tombstones, 'accounts', account.id) });
      return null;
    },

    deleteAccount(id, reassignId) {
      if (get().accounts.length <= 1) return 'Keep at least one account.';
      const used = get().transactions.some((item) => item.accountId === id || item.toAccountId === id);
      if (used && (!reassignId || reassignId === id)) return 'Choose an account to reassign these transactions.';
      const stamp = nowIso();
      publish({
        ...snapshot(get()),
        accounts: get().accounts.filter((item) => item.id !== id),
        transactions: get().transactions.map((item) => ({
          ...item,
          accountId: item.accountId === id ? reassignId : item.accountId,
          toAccountId: item.toAccountId === id ? reassignId : item.toAccountId,
          updatedAt: item.accountId === id || item.toAccountId === id ? stamp : item.updatedAt,
        })),
        recurring: get().recurring.map((item) => ({
          ...item,
          accountId: item.accountId === id ? reassignId : item.accountId,
          toAccountId: item.toAccountId === id ? reassignId : item.toAccountId,
          updatedAt: item.accountId === id || item.toAccountId === id ? stamp : item.updatedAt,
        })),
        tombstones: addTombstone(get().tombstones, 'accounts', id),
      });
      return null;
    },

    saveBudget(input) {
      const error = validateBudget(input.amount, input.startDate, input.endDate);
      if (error) return error;
      const stamp = nowIso();
      if (input.kind === 'category' && input.everyMonth) {
        publish({
          ...snapshot(get()),
          categories: get().categories.map((item) => (item.id === input.categoryId ? { ...item, budgetAmount: normalizeAmount(input.amount), updatedAt: stamp } : item)),
        });
        return null;
      }
      const existing = input.id ? get().budgets.find((item) => item.id === input.id) : undefined;
      const budget: Budget = {
        id: existing?.id ?? makeId(),
        name: input.name.trim() || 'Budget',
        kind: input.kind,
        categoryId: input.categoryId,
        amount: normalizeAmount(input.amount),
        month: input.month,
        startDate: input.startDate,
        endDate: input.endDate,
        createdAt: existing?.createdAt ?? stamp,
        updatedAt: stamp,
      };
      const budgets = existing ? get().budgets.map((item) => (item.id === budget.id ? budget : item)) : [...get().budgets, budget];
      publish({ ...snapshot(get()), budgets, tombstones: clearTombstone(get().tombstones, 'budgets', budget.id) });
      return null;
    },

    deleteBudget(id) {
      if (id.startsWith('template:')) {
        const categoryId = id.slice('template:'.length);
        publish({
          ...snapshot(get()),
          categories: get().categories.map((item) => (item.id === categoryId ? { ...item, budgetAmount: 0, updatedAt: nowIso() } : item)),
        });
        return;
      }
      publish({
        ...snapshot(get()),
        budgets: get().budgets.filter((item) => item.id !== id),
        tombstones: addTombstone(get().tombstones, 'budgets', id),
      });
    },

    saveGoal(input) {
      const error = validateGoal(input.name, input.targetAmount, input.currentAmount);
      if (error) return error;
      const stamp = nowIso();
      const existing = input.id ? get().goals.find((item) => item.id === input.id) : undefined;
      const goal: SavingsGoal = {
        id: existing?.id ?? makeId(),
        name: input.name.trim(),
        targetAmount: normalizeAmount(input.targetAmount),
        currentAmount: normalizeAmount(input.currentAmount),
        targetDate: input.targetDate,
        icon: input.icon,
        color: input.color,
        contributions: existing?.contributions ?? [],
        createdAt: existing?.createdAt ?? stamp,
        updatedAt: stamp,
      };
      const goals = existing ? get().goals.map((item) => (item.id === goal.id ? goal : item)) : [...get().goals, goal];
      publish({ ...snapshot(get()), goals, tombstones: clearTombstone(get().tombstones, 'goals', goal.id) });
      return null;
    },

    deleteGoal(id) {
      publish({ ...snapshot(get()), goals: get().goals.filter((item) => item.id !== id), tombstones: addTombstone(get().tombstones, 'goals', id) });
    },

    addContribution(goalId, amount, date, note) {
      if (!Number.isFinite(amount) || amount === 0) return 'Enter an amount.';
      const goal = get().goals.find((item) => item.id === goalId);
      if (!goal) return 'Goal not found.';
      const nextAmount = normalizeAmount(goal.currentAmount + amount);
      if (nextAmount < 0) return 'That would make the saved amount negative.';
      const goals = get().goals.map((item) =>
        item.id === goalId
          ? {
              ...item,
              currentAmount: nextAmount,
              contributions: [{ id: makeId(), amount: normalizeAmount(amount), date, note: note.trim() }, ...item.contributions],
              updatedAt: nowIso(),
            }
          : item,
      );
      publish({ ...snapshot(get()), goals });
      return null;
    },

    saveRecurring(input) {
      const error = validateTransaction({ ...input, date: input.nextDate ? `${input.nextDate}T12:00:00` : '' }, get());
      if (error) return error;
      if (!input.nextDate) return 'Choose the next date.';
      const stamp = nowIso();
      const existing = input.id ? get().recurring.find((item) => item.id === input.id) : undefined;
      const rule: RecurringRule = {
        ...input,
        id: existing?.id ?? makeId(),
        description: input.description.trim(),
        notes: input.notes.trim(),
        amount: normalizeAmount(input.amount),
        anchorDay: Number(input.nextDate.slice(8, 10)) || input.anchorDay || 1,
        reminderDays: Math.max(0, Math.min(30, input.reminderDays)),
        createdAt: existing?.createdAt ?? stamp,
        updatedAt: stamp,
      };
      const recurring = existing ? get().recurring.map((item) => (item.id === rule.id ? rule : item)) : [...get().recurring, rule];
      publish({ ...snapshot(get()), recurring, tombstones: clearTombstone(get().tombstones, 'recurring', rule.id) });
      return null;
    },

    deleteRecurring(id) {
      publish({
        ...snapshot(get()),
        recurring: get().recurring.filter((item) => item.id !== id),
        tombstones: addTombstone(get().tombstones, 'recurring', id),
      });
    },

    skipRecurring(id) {
      publish({
        ...snapshot(get()),
        recurring: get().recurring.map((item) =>
          item.id === id ? { ...item, nextDate: advanceDate(item.nextDate, item.frequency, item.anchorDay), updatedAt: nowIso() } : item,
        ),
      });
    },

    markRead(id) {
      const notifications: AppNotification[] = get().notifications.map((item) => (item.id === id ? { ...item, read: true, updatedAt: nowIso() } : item));
      publish({ ...snapshot(get()), notifications });
    },

    markAllRead() {
      const stamp = nowIso();
      publish({ ...snapshot(get()), notifications: get().notifications.map((item) => ({ ...item, read: true, updatedAt: stamp })) });
    },

    updateSettings(patch) {
      const settings = { ...get().settings, ...patch, id: 'settings' as const, updatedAt: nowIso() };
      if (patch.theme) applyTheme(patch.theme);
      if (patch.language) applyLanguage(patch.language);
      publish({ ...snapshot(get()), settings });
    },

    updateProfile(patch) {
      publish({ ...snapshot(get()), userProfile: { ...get().userProfile, ...patch, updatedAt: nowIso() } });
    },

    async importFile(file) {
      const lower = file.name.toLowerCase();
      if (lower.endsWith('.xlsx') || lower.endsWith('.xls')) {
        const XLSX = await import('xlsx');
        const book = XLSX.read(await file.arrayBuffer(), { type: 'array' });
        const sheet = book.Sheets[book.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json<Record<string, string | number>>(sheet, { defval: '' });
        const result = importRecords(rows, snapshot(get()));
        publish(result.state);
        return result;
      }
      const result = importCsvText(await file.text(), snapshot(get()));
      publish(result.state);
      return result;
    },

    restoreBackup(data) {
      publish({ ...data, version: 1 });
      get().toast('Backup restored on this device.');
    },

    loadDemo() {
      publish(applyDemo(snapshot(get())));
      get().toast('Sample month added.');
    },

    eraseAll() {
      const current = get();
      const fresh = createInitialState();
      fresh.settings = {
        ...fresh.settings,
        currency: current.settings.currency,
        language: current.settings.language,
        theme: current.settings.theme,
        notifications: current.settings.notifications,
        updatedAt: nowIso(),
      };
      fresh.userProfile = { ...current.userProfile, updatedAt: nowIso() };
      publish(fresh);
      get().toast('Financial records erased from this device.');
    },

    async signInEmail(email, password) {
      try {
        await signIn(email, password);
        return null;
      } catch (error) {
        return authErrorMessage(error);
      }
    },

    async signUpEmail(email, password) {
      if (password.length < 8) return 'Use at least 8 characters.';
      try {
        await signUp(email, password);
        return null;
      } catch (error) {
        return authErrorMessage(error);
      }
    },

    async sendReset(email) {
      try {
        await resetPassword(email);
        return null;
      } catch (error) {
        return authErrorMessage(error);
      }
    },

    async signOutUser() {
      await logOut();
      set({ authUser: null, syncStatus: 'local' });
    },

    async syncNow() {
      const state = get();
      if (!isFirebaseConfigured() || !state.authUser) {
        const nextStatus = state.online ? 'local' : 'offline';
        if (state.syncStatus !== nextStatus) set({ syncStatus: nextStatus });
        return;
      }
      if (!state.online) {
        if (state.syncStatus !== 'offline') set({ syncStatus: 'offline' });
        return;
      }
      if (state.status !== 'ready' || syncing) return;
      syncing = true;
      set({ syncStatus: 'syncing' });
      try {
        const merged = await syncState(state.authUser.uid, snapshot(get()));
        suppressSync = true;
        const next = prepare(merged);
        set({ ...next, syncStatus: 'synced' });
        await repository.save(next);
      } catch (error) {
        console.error('Sync failed');
        set({ syncStatus: 'error' });
        get().toast(authErrorMessage(error));
      } finally {
        suppressSync = false;
        syncing = false;
      }
    },

    toast(message) {
      const id = makeId();
      set({ toasts: [...get().toasts, { id, message }] });
      window.setTimeout(() => get().dismissToast(id), 5000);
    },

    dismissToast(id) {
      set({ toasts: get().toasts.filter((item) => item.id !== id) });
    },

    confirm(options) {
      return new Promise((resolve) => {
        get().dialog?.resolve(false);
        set({
          dialog: {
            title: options.title,
            message: options.message,
            confirmLabel: options.confirmLabel ?? 'Confirm',
            danger: Boolean(options.danger),
            resolve,
          },
        });
      });
    },

    closeDialog(value) {
      get().dialog?.resolve(value);
      set({ dialog: null });
    },
  };
});

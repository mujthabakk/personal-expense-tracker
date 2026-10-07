export const EPOCH = '1970-01-01T00:00:00.000Z';

export type TransactionType = 'expense' | 'income' | 'transfer';
export type PaymentMethod = 'cash' | 'bank' | 'upi' | 'credit_card' | 'debit_card' | 'wallet' | 'other';
export type Frequency = 'daily' | 'weekly' | 'monthly' | 'yearly';
export type AccountType = 'cash' | 'bank' | 'savings' | 'credit_card' | 'upi' | 'wallet' | 'custom';
export type ThemeMode = 'light' | 'dark' | 'system';
export type Language = 'en' | 'hi';
export type BudgetKind = 'monthly' | 'category' | 'custom';
export type NotificationType = 'budget_warning' | 'budget_exceeded' | 'recurring' | 'goal' | 'monthly_summary';

export interface Transaction {
  id: string;
  type: TransactionType;
  amount: number;
  categoryId: string;
  accountId: string;
  toAccountId: string;
  paymentMethod: PaymentMethod;
  description: string;
  notes: string;
  date: string;
  createdAt: string;
  updatedAt: string;
  recurringTransactionId: string;
}

export interface Category {
  id: string;
  name: string;
  type: 'expense' | 'income';
  icon: string;
  color: string;
  budgetAmount: number;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  openingBalance: number;
  institution: string;
  color: string;
  icon: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Budget {
  id: string;
  name: string;
  kind: BudgetKind;
  categoryId: string;
  amount: number;
  month: string;
  startDate: string;
  endDate: string;
  createdAt: string;
  updatedAt: string;
}

export interface Contribution {
  id: string;
  amount: number;
  date: string;
  note: string;
}

export interface SavingsGoal {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  targetDate: string;
  icon: string;
  color: string;
  contributions: Contribution[];
  createdAt: string;
  updatedAt: string;
}

export interface RecurringRule {
  id: string;
  type: TransactionType;
  amount: number;
  categoryId: string;
  accountId: string;
  toAccountId: string;
  paymentMethod: PaymentMethod;
  description: string;
  notes: string;
  frequency: Frequency;
  nextDate: string;
  anchorDay: number;
  reminderDays: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AppNotification {
  id: string;
  type: NotificationType;
  titleKey: string;
  messageKey: string;
  vars: Record<string, string | number>;
  href: string;
  read: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Tombstone {
  id: string;
  collection: CollectionName;
  entityId: string;
  deletedAt: string;
}

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  createdAt: string;
  updatedAt: string;
}

export interface Settings {
  id: 'settings';
  currency: string;
  language: Language;
  theme: ThemeMode;
  notifications: {
    budgetWarning: boolean;
    budgetExceeded: boolean;
    recurring: boolean;
    goals: boolean;
    monthlySummary: boolean;
  };
  lastCategoryId: string;
  lastPaymentMethod: PaymentMethod;
  lastAccountId: string;
  recentCategoryIds: string[];
  recentPaymentMethods: PaymentMethod[];
  summaryNotifiedFor: string;
  updatedAt: string;
}

export interface PersistedState {
  version: 1;
  transactions: Transaction[];
  categories: Category[];
  accounts: Account[];
  budgets: Budget[];
  goals: SavingsGoal[];
  recurring: RecurringRule[];
  notifications: AppNotification[];
  tombstones: Tombstone[];
  userProfile: UserProfile;
  settings: Settings;
}

export type CollectionName =
  | 'transactions'
  | 'categories'
  | 'accounts'
  | 'budgets'
  | 'goals'
  | 'recurring'
  | 'notifications'
  | 'profile';

export interface SecurityMeta {
  id: 'meta';
  initialized: boolean;
  encryptionEnabled: boolean;
  salt: string;
  verifierIv: string;
  verifier: string;
  iterations: number;
  failedAttempts: number;
  lockUntil: number;
  biometricEnabled: boolean;
  biometricCredentialId: string;
  biometricWrapped: string;
  biometricWrapIv: string;
}

export const PAYMENT_METHODS: PaymentMethod[] = [
  'cash',
  'bank',
  'upi',
  'credit_card',
  'debit_card',
  'wallet',
  'other',
];

export const ACCOUNT_TYPES: AccountType[] = [
  'cash',
  'bank',
  'savings',
  'credit_card',
  'upi',
  'wallet',
  'custom',
];

export const FREQUENCIES: Frequency[] = ['daily', 'weekly', 'monthly', 'yearly'];

export const CURRENCIES = [
  { code: 'INR', label: 'Indian Rupee (₹)' },
  { code: 'USD', label: 'US Dollar ($)' },
  { code: 'EUR', label: 'Euro (€)' },
  { code: 'GBP', label: 'British Pound (£)' },
  { code: 'AED', label: 'UAE Dirham (AED)' },
] as const;

export const CATEGORY_COLORS = [
  '#0f7a5a',
  '#1d4e89',
  '#b45309',
  '#7a3e5c',
  '#0f6e8c',
  '#3f6212',
  '#9a3412',
  '#334155',
  '#5b4b8a',
  '#0f5f6b',
  '#8a4b2f',
  '#1e3a5f',
];

export const QUICK_EXPENSES = [
  { amount: 100, categoryId: 'cat-food', label: 'Food' },
  { amount: 200, categoryId: 'cat-transport', label: 'Transport' },
  { amount: 500, categoryId: 'cat-shopping', label: 'Shopping' },
] as const;

export const QUICK_INCOME = [
  { categoryId: 'cat-salary', label: 'Salary' },
  { categoryId: 'cat-freelance', label: 'Freelance' },
  { categoryId: 'cat-bonus', label: 'Bonus' },
  { categoryId: 'cat-gift', label: 'Gift' },
] as const;

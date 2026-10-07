import {
  ACCOUNT_TYPES,
  CATEGORY_COLORS,
  EPOCH,
  type Account,
  type Category,
  type PersistedState,
  type Settings,
  type UserProfile,
} from '@/models/types';

const expenseCategories: Array<[string, string, string]> = [
  ['cat-food', 'Food', 'utensils'],
  ['cat-groceries', 'Groceries', 'basket'],
  ['cat-transport', 'Transport', 'bus'],
  ['cat-fuel', 'Fuel', 'fuel'],
  ['cat-shopping', 'Shopping', 'bag'],
  ['cat-bills', 'Bills', 'receipt'],
  ['cat-rent', 'Rent', 'home'],
  ['cat-entertainment', 'Entertainment', 'film'],
  ['cat-health', 'Health', 'heart'],
  ['cat-education', 'Education', 'graduation'],
  ['cat-travel', 'Travel', 'plane'],
  ['cat-fitness', 'Fitness', 'dumbbell'],
  ['cat-subscriptions', 'Subscriptions', 'repeat'],
  ['cat-insurance', 'Insurance', 'shield'],
  ['cat-investment', 'Investment', 'trending'],
  ['cat-personal-care', 'Personal Care', 'sparkles'],
  ['cat-family', 'Family', 'users'],
  ['cat-other', 'Other', 'circle'],
];

const incomeCategories: Array<[string, string, string]> = [
  ['cat-salary', 'Salary', 'briefcase'],
  ['cat-freelance', 'Freelance', 'laptop'],
  ['cat-business', 'Business', 'building'],
  ['cat-returns', 'Investment Returns', 'chart'],
  ['cat-bonus', 'Bonus', 'gift'],
  ['cat-gift', 'Gift', 'party'],
  ['cat-income-other', 'Other', 'circle'],
];

function category(id: string, name: string, icon: string, type: 'expense' | 'income', index: number): Category {
  return {
    id,
    name,
    type,
    icon,
    color: CATEGORY_COLORS[index % CATEGORY_COLORS.length],
    budgetAmount: 0,
    isDefault: true,
    createdAt: EPOCH,
    updatedAt: EPOCH,
  };
}

export function defaultCategories(): Category[] {
  return [
    ...expenseCategories.map(([id, name, icon], index) => category(id, name, icon, 'expense', index)),
    ...incomeCategories.map(([id, name, icon], index) => category(id, name, icon, 'income', index + 3)),
  ];
}

export function defaultAccounts(): Account[] {
  return [
    {
      id: 'acc-cash',
      name: 'Cash',
      type: 'cash',
      openingBalance: 0,
      institution: '',
      color: '#0f7a5a',
      icon: 'cash',
      isDefault: true,
      createdAt: EPOCH,
      updatedAt: EPOCH,
    },
    {
      id: 'acc-bank',
      name: 'Bank Account',
      type: 'bank',
      openingBalance: 0,
      institution: '',
      color: '#1d4e89',
      icon: 'bank',
      isDefault: true,
      createdAt: EPOCH,
      updatedAt: EPOCH,
    },
  ];
}

export function defaultSettings(): Settings {
  return {
    id: 'settings',
    currency: 'INR',
    language: 'en',
    theme: 'system',
    notifications: {
      budgetWarning: true,
      budgetExceeded: true,
      recurring: true,
      goals: true,
      monthlySummary: true,
    },
    lastCategoryId: '',
    lastPaymentMethod: 'cash',
    lastAccountId: 'acc-cash',
    recentCategoryIds: [],
    recentPaymentMethods: ['cash'],
    summaryNotifiedFor: '',
    updatedAt: EPOCH,
  };
}

export function defaultProfile(): UserProfile {
  return { id: 'profile', name: '', email: '', createdAt: EPOCH, updatedAt: EPOCH };
}

export function createInitialState(): PersistedState {
  return {
    version: 1,
    transactions: [],
    categories: defaultCategories(),
    accounts: defaultAccounts(),
    budgets: [],
    goals: [],
    recurring: [],
    notifications: [],
    tombstones: [],
    userProfile: defaultProfile(),
    settings: defaultSettings(),
  };
}

export const ACCOUNT_TYPE_LABELS: Record<(typeof ACCOUNT_TYPES)[number], string> = {
  cash: 'Cash',
  bank: 'Bank Account',
  savings: 'Savings Account',
  credit_card: 'Credit Card',
  upi: 'UPI',
  wallet: 'Wallet',
  custom: 'Custom Account',
};

export const PAYMENT_LABELS = {
  cash: 'Cash',
  bank: 'Bank',
  upi: 'UPI',
  credit_card: 'Credit Card',
  debit_card: 'Debit Card',
  wallet: 'Wallet',
  other: 'Other',
} as const;

export const FREQUENCY_LABELS = {
  daily: 'Daily',
  weekly: 'Weekly',
  monthly: 'Monthly',
  yearly: 'Yearly',
} as const;

import { useCallback } from 'react';
import { useLedger } from '@/store/ledger';

const hi: Record<string, string> = {
  Home: 'होम',
  Transactions: 'लेनदेन',
  Budgets: 'बजट',
  Reports: 'रिपोर्ट',
  Profile: 'प्रोफ़ाइल',
  Goals: 'लक्ष्य',
  Recurring: 'नियमित',
  Accounts: 'खाते',
  Categories: 'श्रेणियाँ',
  Notifications: 'सूचनाएँ',
  'Add transaction': 'लेनदेन जोड़ें',
  'Total balance': 'कुल बैलेंस',
  Income: 'आय',
  Expenses: 'खर्च',
  Savings: 'बचत',
  'This month': 'इस महीने',
  'Monthly overview': 'मासिक झलक',
  'Remaining budget': 'बचा बजट',
  'Savings rate': 'बचत दर',
  'Spending categories': 'खर्च की श्रेणियाँ',
  'Recent transactions': 'हाल के लेनदेन',
  'View all': 'सभी देखें',
  'No transactions yet.': 'अभी कोई लेनदेन नहीं।',
  'Start tracking your spending by adding your first expense.': 'पहला खर्च जोड़कर अपनी खर्च की ट्रैकिंग शुरू करें।',
  'No budgets created.': 'कोई बजट नहीं बना।',
  'Create a budget to control your monthly spending.': 'मासिक खर्च नियंत्रित करने के लिए बजट बनाएँ।',
  'No savings goals.': 'कोई बचत लक्ष्य नहीं।',
  'Create your first financial goal.': 'अपना पहला वित्तीय लक्ष्य बनाएँ।',
  Search: 'खोजें',
  Filter: 'फ़िल्टर',
  Save: 'सहेजें',
  Cancel: 'रद्द करें',
  Delete: 'हटाएँ',
  Edit: 'संपादित करें',
  Duplicate: 'प्रतिलिपि',
  Expense: 'खर्च',
  Transfer: 'ट्रांसफ़र',
  Amount: 'राशि',
  Category: 'श्रेणी',
  Description: 'विवरण',
  Date: 'तारीख',
  'Payment method': 'भुगतान का तरीका',
  Account: 'खाता',
  Notes: 'नोट्स',
  'All transactions': 'सभी लेनदेन',
  Settings: 'सेटिंग्स',
  Currency: 'मुद्रा',
  Language: 'भाषा',
  Theme: 'थीम',
  Security: 'सुरक्षा',
  'App lock': 'ऐप लॉक',
  About: 'परिचय',
  Backup: 'बैकअप',
  Export: 'निर्यात',
  Import: 'आयात',
  'Light': 'लाइट',
  Dark: 'डार्क',
  System: 'सिस्टम',
  'On track': 'नियंत्रण में',
  'Near limit': 'सीमा के पास',
  Exceeded: 'सीमा पार',
  'Private · on this device': 'निजी · इस डिवाइस पर',
  Synced: 'सिंक हो गया',
  Syncing: 'सिंक हो रहा है',
  Offline: 'ऑफ़लाइन',
  'Sign in': 'साइन इन',
  'Sign out': 'साइन आउट',
  'Create account': 'खाता बनाएँ',
  'Load sample month': 'नमूना महीना लोड करें',
  'Erase data': 'डेटा मिटाएँ',
};

export function translate(language: string, text: string, vars?: Record<string, string | number>): string {
  let value = language === 'hi' ? hi[text] ?? text : text;
  if (vars) {
    for (const [key, replacement] of Object.entries(vars)) value = value.replaceAll(`{${key}}`, String(replacement));
  }
  return value;
}

export function useI18n() {
  const language = useLedger((state) => state.settings.language);
  return useCallback((text: string, vars?: Record<string, string | number>) => translate(language, text, vars), [language]);
}

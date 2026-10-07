import { formatMoney, roundMoney } from '@/lib/money';
import type { Account, Category, Transaction } from '@/models/types';
import { computeAccountBalance, spendingByCategory, totalsFor } from '@/services/finance';

const UNWANTED = new Set(['cat-shopping', 'cat-entertainment', 'cat-subscriptions', 'cat-personal-care']);
const LIQUID = new Set(['cash', 'bank', 'savings', 'wallet', 'upi']);

export interface PlanSlice {
  id: string;
  name: string;
  monthly: number;
  note: string;
}

export interface InvestmentPlan {
  income: number;
  expense: number;
  surplus: number;
  essential: number;
  unwanted: number;
  liquid: number;
  emergencyTarget: number;
  emergencyMonths: number;
  stage: 'needs-income' | 'overspending' | 'emergency' | 'building' | 'investing';
  headline: string;
  steps: string[];
  slices: PlanSlice[];
}

export function buildInvestmentPlan(
  transactions: Transaction[],
  categories: Category[],
  accounts: Account[],
  month: string,
  currency = 'INR',
  language = 'en',
): InvestmentPlan {
  const money = (amount: number) => formatMoney(amount, currency, language);
  const totals = totalsFor(transactions, month);
  const spend = spendingByCategory(transactions, categories, month);
  const unwanted = roundMoney(spend.filter((item) => UNWANTED.has(item.categoryId)).reduce((sum, item) => sum + item.amount, 0));
  const essential = roundMoney(Math.max(totals.expense - unwanted, 0));
  const monthlyNeed = essential > 0 ? essential : totals.expense;
  const emergencyTarget = roundMoney(monthlyNeed * 6);
  const liquid = roundMoney(
    accounts.reduce((sum, account) => {
      if (!LIQUID.has(account.type)) return sum;
      return sum + Math.max(0, computeAccountBalance(account, transactions));
    }, 0),
  );
  const emergencyMonths = monthlyNeed > 0 ? liquid / monthlyNeed : liquid > 0 ? 6 : 0;
  const surplus = totals.savings;

  if (totals.income <= 0) {
    return plan({
      totals, essential, unwanted, liquid, emergencyTarget, emergencyMonths, surplus,
      stage: 'needs-income',
      headline: 'Add this month’s income first.',
      steps: ['Record salary or other income.', 'The plan splits only money that is left after spending.'],
      slices: [],
    });
  }

  if (surplus <= 0) {
    return plan({
      totals, essential, unwanted, liquid, emergencyTarget, emergencyMonths, surplus,
      stage: 'overspending',
      headline: 'Free up cash before investing.',
      steps: [
        unwanted > 0 ? `Cut shopping, entertainment, and subscriptions. They were ${money(unwanted)} this month.` : 'Spending is above income. Pause new investments until the month ends positive.',
        'Keep rent, bills, groceries, health, and existing investments.',
        'Invest only after the month leaves a surplus.',
      ],
      slices: [],
    });
  }

  if (emergencyMonths < 3) {
    const slices = split(surplus, [
      ['emergency', 'Emergency fund', 0.8, 'Cash or a savings account you can use within a day.'],
      ['equity', 'Index fund SIP', 0.2, 'A broad equity index fund for money you can leave for 5 years or more.'],
    ]);
    return plan({
      totals, essential, unwanted, liquid, emergencyTarget, emergencyMonths, surplus,
      stage: 'emergency',
      headline: 'Build a 6-month emergency fund, and start a small SIP.',
      steps: [
        `Put ${money(slices[0]?.monthly ?? 0)} a month into emergency savings until you hold 6 months of essential costs.`,
        `Put ${money(slices[1]?.monthly ?? 0)} a month into an index fund so investing starts now.`,
        'Do not invest money you may need within a year.',
      ],
      slices,
    });
  }

  if (emergencyMonths < 6) {
    const slices = split(surplus, [
      ['emergency', 'Emergency fund', 0.4, 'Finish the 6-month cushion.'],
      ['equity', 'Index fund SIP', 0.5, 'The main long-term investment.'],
      ['debt', 'Safer debt', 0.1, 'PPF, EPF top-up, or a short-term debt fund.'],
    ]);
    return plan({
      totals, essential, unwanted, liquid, emergencyTarget, emergencyMonths, surplus,
      stage: 'building',
      headline: 'You have a start. Finish the emergency fund and raise the SIP.',
      steps: ['Keep filling the emergency fund until it covers 6 months.', 'Most of the rest goes to an index fund.', 'A small share stays in safer debt.'],
      slices,
    });
  }

  const slices = split(surplus, [
    ['equity', 'Index fund SIP', 0.7, 'Core holding for goals more than 5 years away.'],
    ['debt', 'Safer debt', 0.2, 'PPF, EPF, or a debt fund for stability.'],
    ['gold', 'Gold', 0.1, 'A small balance, not the main plan.'],
  ]);
  return plan({
    totals, essential, unwanted, liquid, emergencyTarget, emergencyMonths, surplus,
    stage: 'investing',
    headline: 'Emergency fund is in place. Invest the monthly surplus.',
    steps: ['Send 70% of the surplus to an index fund SIP.', 'Keep 20% in safer debt.', 'Keep 10% in gold.', 'Increase the SIP when income rises. Do not stop it for shopping.'],
    slices,
  });
}

function plan(input: {
  totals: { income: number; expense: number };
  essential: number;
  unwanted: number;
  liquid: number;
  emergencyTarget: number;
  emergencyMonths: number;
  surplus: number;
  stage: InvestmentPlan['stage'];
  headline: string;
  steps: string[];
  slices: PlanSlice[];
}): InvestmentPlan {
  return {
    income: input.totals.income,
    expense: input.totals.expense,
    surplus: input.surplus,
    essential: input.essential,
    unwanted: input.unwanted,
    liquid: input.liquid,
    emergencyTarget: input.emergencyTarget,
    emergencyMonths: input.emergencyMonths,
    stage: input.stage,
    headline: input.headline,
    steps: input.steps,
    slices: input.slices,
  };
}

function split(total: number, weights: Array<[string, string, number, string]>): PlanSlice[] {
  let used = 0;
  return weights.map(([id, name, share, note], index) => {
    const monthly = index === weights.length - 1 ? roundMoney(total - used) : roundMoney(total * share);
    used = roundMoney(used + monthly);
    return { id, name, monthly, note };
  }).filter((slice) => slice.monthly > 0);
}

import { nowIso } from '@/lib/id';
import type { CollectionName, PaymentMethod, PersistedState, Settings, Tombstone } from '@/models/types';

export function snapshot(state: PersistedState): PersistedState {
  return {
    version: 1,
    transactions: state.transactions,
    categories: state.categories,
    accounts: state.accounts,
    budgets: state.budgets,
    goals: state.goals,
    recurring: state.recurring,
    notifications: state.notifications,
    tombstones: state.tombstones,
    userProfile: state.userProfile,
    settings: state.settings,
  };
}

export function addTombstone(list: Tombstone[], collection: CollectionName, entityId: string): Tombstone[] {
  const id = `${collection}:${entityId}`;
  return [...list.filter((item) => item.id !== id), { id, collection, entityId, deletedAt: nowIso() }];
}

export function clearTombstone(list: Tombstone[], collection: CollectionName, entityId: string): Tombstone[] {
  return list.filter((item) => item.id !== `${collection}:${entityId}`);
}

export function remember(settings: Settings, categoryId: string, payment: PaymentMethod, accountId: string): Settings {
  return {
    ...settings,
    lastCategoryId: categoryId || settings.lastCategoryId,
    lastPaymentMethod: payment,
    lastAccountId: accountId,
    recentCategoryIds: categoryId
      ? [categoryId, ...settings.recentCategoryIds.filter((id) => id !== categoryId)].slice(0, 6)
      : settings.recentCategoryIds,
    recentPaymentMethods: [payment, ...settings.recentPaymentMethods.filter((item) => item !== payment)].slice(0, 4),
    updatedAt: nowIso(),
  };
}

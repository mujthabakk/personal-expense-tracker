import { collection, doc, getDocs, writeBatch, type Firestore, type WriteBatch } from 'firebase/firestore';
import { getFirebase } from '@/lib/firebase';
import type { CollectionName, PersistedState, Tombstone } from '@/models/types';
import { mergeCollection, mergeTombstones } from '@/services/syncMerge';

const COLLECTIONS: Array<{ name: CollectionName; key: keyof PersistedState }> = [
  { name: 'transactions', key: 'transactions' },
  { name: 'categories', key: 'categories' },
  { name: 'accounts', key: 'accounts' },
  { name: 'budgets', key: 'budgets' },
  { name: 'goals', key: 'goals' },
  { name: 'recurring', key: 'recurring' },
  { name: 'notifications', key: 'notifications' },
];

function clean<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function userCollection(firestore: Firestore, uid: string, name: string) {
  return collection(firestore, 'users', uid, name);
}

async function commitWrites(firestore: Firestore, writes: Array<(batch: WriteBatch) => void>) {
  for (let index = 0; index < writes.length; index += 400) {
    const batch = writeBatch(firestore);
    for (const write of writes.slice(index, index + 400)) write(batch);
    if (writes.slice(index, index + 400).length) await batch.commit();
  }
}

export async function syncState(uid: string, local: PersistedState): Promise<PersistedState> {
  const firebase = getFirebase();
  if (!firebase) return local;
  const firestore = firebase.firestore;
  const tombSnap = await getDocs(userCollection(firestore, uid, 'tombstones'));
  const remoteTombs = tombSnap.docs.map((item) => item.data() as Tombstone);
  let tombstones = mergeTombstones(local.tombstones, remoteTombs);
  const next: PersistedState = { ...local, tombstones };
  const writes: Array<(batch: WriteBatch) => void> = [];

  for (const entry of COLLECTIONS) {
    const snap = await getDocs(userCollection(firestore, uid, entry.name));
    const remote = snap.docs.map((item) => item.data() as { id: string; updatedAt: string });
    const localItems = next[entry.key] as Array<{ id: string; updatedAt: string }>;
    const merged = mergeCollection(entry.name, localItems, remote, tombstones);
    tombstones = merged.tombstones;
    Object.assign(next, { [entry.key]: merged.next });
    for (const item of merged.upload) {
      writes.push((batch) => batch.set(doc(firestore, 'users', uid, entry.name, item.id), clean(item)));
    }
    for (const id of merged.deleteRemote) {
      writes.push((batch) => batch.delete(doc(firestore, 'users', uid, entry.name, id)));
    }
  }

  next.tombstones = tombstones;
  const remoteIds = new Set(remoteTombs.map((item) => item.id));
  for (const tomb of tombstones) {
    if (!remoteIds.has(tomb.id)) {
      writes.push((batch) => batch.set(doc(firestore, 'users', uid, 'tombstones', tomb.id), clean(tomb)));
    }
  }
  for (const tomb of remoteTombs) {
    if (!tombstones.some((item) => item.id === tomb.id)) {
      writes.push((batch) => batch.delete(doc(firestore, 'users', uid, 'tombstones', tomb.id)));
    }
  }

  const settingsSnap = await getDocs(userCollection(firestore, uid, 'settings'));
  const remoteSettings = settingsSnap.docs[0]?.data() as PersistedState['settings'] | undefined;
  if (!remoteSettings || local.settings.updatedAt >= (remoteSettings.updatedAt ?? '')) {
    next.settings = local.settings;
    if (!remoteSettings || local.settings.updatedAt > (remoteSettings.updatedAt ?? '')) {
      writes.push((batch) => batch.set(doc(firestore, 'users', uid, 'settings', 'settings'), clean(local.settings)));
    }
  } else {
    next.settings = { ...remoteSettings, id: 'settings' };
  }

  const profileSnap = await getDocs(userCollection(firestore, uid, 'profile'));
  const remoteProfile = profileSnap.docs[0]?.data() as PersistedState['userProfile'] | undefined;
  if (!remoteProfile || local.userProfile.updatedAt >= (remoteProfile.updatedAt ?? '')) {
    next.userProfile = local.userProfile;
    if (!remoteProfile || local.userProfile.updatedAt > (remoteProfile.updatedAt ?? '')) {
      writes.push((batch) => batch.set(doc(firestore, 'users', uid, 'profile', 'profile'), clean(local.userProfile)));
    }
  } else {
    next.userProfile = { ...remoteProfile, id: 'profile' };
  }

  if (writes.length) await commitWrites(firestore, writes);
  return next;
}

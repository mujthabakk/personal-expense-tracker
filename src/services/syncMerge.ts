import type { CollectionName, Tombstone } from '@/models/types';

interface RecordLike {
  id: string;
  updatedAt: string;
}

export interface MergeResult<T extends RecordLike> {
  next: T[];
  upload: T[];
  deleteRemote: string[];
  tombstones: Tombstone[];
}

export function mergeCollection<T extends RecordLike>(
  collection: CollectionName,
  local: T[],
  remote: T[],
  tombstones: Tombstone[],
): MergeResult<T> {
  const localMap = new Map(local.map((item) => [item.id, item]));
  const remoteMap = new Map(remote.map((item) => [item.id, item]));
  const tombMap = new Map(
    tombstones.filter((item) => item.collection === collection).map((item) => [item.entityId, item]),
  );
  const ids = new Set<string>([...localMap.keys(), ...remoteMap.keys(), ...tombMap.keys()]);
  const next: T[] = [];
  const upload: T[] = [];
  const deleteRemote: string[] = [];

  for (const id of ids) {
    const left = localMap.get(id);
    const right = remoteMap.get(id);
    const tomb = tombMap.get(id);
    const tombTime = tomb?.deletedAt ?? '';
    const deletedLocal = !left || tombTime > left.updatedAt;
    const deletedRemote = !right || tombTime > right.updatedAt;

    if (tomb && deletedLocal && deletedRemote) {
      if (right) deleteRemote.push(id);
      continue;
    }

    if (left && right) {
      if (left.updatedAt >= right.updatedAt) {
        next.push(left);
        if (left.updatedAt > right.updatedAt) upload.push(left);
      } else {
        next.push(right);
      }
      continue;
    }

    if (left && !right) {
      next.push(left);
      if (!tomb || left.updatedAt > tombTime) upload.push(left);
      continue;
    }

    if (right && !left) {
      if (tomb && tombTime > right.updatedAt) deleteRemote.push(id);
      else next.push(right);
    }
  }

  const alive = new Set(next.map((item) => item.id));
  return {
    next,
    upload,
    deleteRemote,
    tombstones: tombstones.filter((item) => item.collection !== collection || !alive.has(item.entityId)),
  };
}

export function mergeTombstones(local: Tombstone[], remote: Tombstone[]): Tombstone[] {
  const map = new Map<string, Tombstone>();
  for (const item of [...local, ...remote]) {
    const current = map.get(item.id);
    if (!current || item.deletedAt > current.deletedAt) map.set(item.id, item);
  }
  return [...map.values()];
}

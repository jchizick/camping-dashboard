import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import {
  validateActiveTripSnapshot,
  type ActiveTripSnapshot,
} from './activeTripSnapshot';

export const ACTIVE_TRIP_DATABASE_NAME = 'field-protocol-active-trip';
export const ACTIVE_TRIP_DATABASE_VERSION = 2;
export const ACTIVE_TRIP_STORE_NAME = 'activeTrips';
export const OFFLINE_IDENTITY_STORE_NAME = 'offlineIdentity';

interface StoredActiveTrip {
  cacheKey: string;
  snapshot: unknown;
}

export interface OfflineIdentityRecord {
  projectNamespace: string;
  activeUserId: string;
  lastVerifiedAt: string;
  shellPreparedAt: string | null;
}

interface ActiveTripDatabase extends DBSchema {
  activeTrips: {
    key: string;
    value: StoredActiveTrip;
  };
  offlineIdentity: {
    key: string;
    value: OfflineIdentityRecord;
  };
}

export interface ActiveTripCacheIdentity {
  projectNamespace: string;
  userId: string;
}

export interface ActiveTripCache {
  readActiveTrip(identity: ActiveTripCacheIdentity): Promise<ActiveTripSnapshot | null>;
  replaceActiveTrip(snapshot: ActiveTripSnapshot): Promise<void>;
  clearCachedTrip(
    identity: ActiveTripCacheIdentity & { tripId: string }
  ): Promise<void>;
  clearUserCache(identity: ActiveTripCacheIdentity): Promise<void>;
  readOfflineIdentity(projectNamespace: string): Promise<OfflineIdentityRecord | null>;
  markShellPrepared(identity: ActiveTripCacheIdentity, preparedAt: string): Promise<boolean>;
  clearOfflineIdentity(projectNamespace: string): Promise<void>;
}

function activeTripCacheKey(identity: ActiveTripCacheIdentity): string {
  return JSON.stringify([identity.projectNamespace, identity.userId]);
}

export function createIndexedDbActiveTripCache(
  databaseName = ACTIVE_TRIP_DATABASE_NAME
) {
  let databasePromise: Promise<IDBPDatabase<ActiveTripDatabase>> | null = null;

  function database() {
    databasePromise ??= openDB<ActiveTripDatabase>(
      databaseName,
      ACTIVE_TRIP_DATABASE_VERSION,
      {
        upgrade(db, oldVersion) {
          if (oldVersion < 1) {
            db.createObjectStore(ACTIVE_TRIP_STORE_NAME, {
              keyPath: 'cacheKey',
            });
          }
          if (oldVersion < 2) {
            db.createObjectStore(OFFLINE_IDENTITY_STORE_NAME, {
              keyPath: 'projectNamespace',
            });
          }
        },
      }
    );
    return databasePromise;
  }

  return {
    async readActiveTrip(
      identity: ActiveTripCacheIdentity
    ): Promise<ActiveTripSnapshot | null> {
      const db = await database();
      const key = activeTripCacheKey(identity);
      const transaction = db.transaction(ACTIVE_TRIP_STORE_NAME, 'readwrite');
      const stored = await transaction.store.get(key);
      if (!stored) {
        await transaction.done;
        return null;
      }

      const snapshot = validateActiveTripSnapshot(stored.snapshot);
      if (
        !snapshot ||
        snapshot.projectNamespace !== identity.projectNamespace ||
        snapshot.userId !== identity.userId
      ) {
        await transaction.store.delete(key);
        await transaction.done;
        return null;
      }
      await transaction.done;
      return snapshot;
    },

    async replaceActiveTrip(snapshot: ActiveTripSnapshot): Promise<void> {
      const validated = validateActiveTripSnapshot(snapshot);
      if (!validated) throw new Error('Refusing to persist an invalid trip snapshot.');
      const db = await database();
      const transaction = db.transaction(
        [ACTIVE_TRIP_STORE_NAME, OFFLINE_IDENTITY_STORE_NAME],
        'readwrite'
      );
      await transaction.objectStore(ACTIVE_TRIP_STORE_NAME).put({
        cacheKey: activeTripCacheKey(validated),
        snapshot: validated,
      });
      const identityStore = transaction.objectStore(OFFLINE_IDENTITY_STORE_NAME);
      const currentIdentity = await identityStore.get(validated.projectNamespace);
      await identityStore.put({
        projectNamespace: validated.projectNamespace,
        activeUserId: validated.userId,
        lastVerifiedAt: validated.lastOnlineVerifiedAt,
        shellPreparedAt:
          currentIdentity?.activeUserId === validated.userId
            ? currentIdentity.shellPreparedAt
            : null,
      });
      await transaction.done;
    },

    async clearCachedTrip(
      identity: ActiveTripCacheIdentity & { tripId: string }
    ): Promise<void> {
      const db = await database();
      const key = activeTripCacheKey(identity);
      const transaction = db.transaction(
        [ACTIVE_TRIP_STORE_NAME, OFFLINE_IDENTITY_STORE_NAME],
        'readwrite'
      );
      const activeStore = transaction.objectStore(ACTIVE_TRIP_STORE_NAME);
      const stored = await activeStore.get(key);
      const snapshot = validateActiveTripSnapshot(stored?.snapshot);
      if (!snapshot || snapshot.tripId === identity.tripId) {
        await activeStore.delete(key);
        const identityStore = transaction.objectStore(OFFLINE_IDENTITY_STORE_NAME);
        const activeIdentity = await identityStore.get(identity.projectNamespace);
        if (activeIdentity?.activeUserId === identity.userId) {
          await identityStore.delete(identity.projectNamespace);
        }
      }
      await transaction.done;
    },

    async clearUserCache(identity: ActiveTripCacheIdentity): Promise<void> {
      const db = await database();
      const transaction = db.transaction(
        [ACTIVE_TRIP_STORE_NAME, OFFLINE_IDENTITY_STORE_NAME],
        'readwrite'
      );
      await transaction
        .objectStore(ACTIVE_TRIP_STORE_NAME)
        .delete(activeTripCacheKey(identity));
      const identityStore = transaction.objectStore(OFFLINE_IDENTITY_STORE_NAME);
      const activeIdentity = await identityStore.get(identity.projectNamespace);
      if (activeIdentity?.activeUserId === identity.userId) {
        await identityStore.delete(identity.projectNamespace);
      }
      await transaction.done;
    },

    async readOfflineIdentity(
      projectNamespace: string
    ): Promise<OfflineIdentityRecord | null> {
      const db = await database();
      const identity = await db.get(OFFLINE_IDENTITY_STORE_NAME, projectNamespace);
      if (
        !identity ||
        identity.projectNamespace !== projectNamespace ||
        typeof identity.activeUserId !== 'string' ||
        !identity.activeUserId ||
        !Number.isFinite(new Date(identity.lastVerifiedAt).getTime()) ||
        (identity.shellPreparedAt !== null &&
          !Number.isFinite(new Date(identity.shellPreparedAt).getTime()))
      ) {
        if (identity) await db.delete(OFFLINE_IDENTITY_STORE_NAME, projectNamespace);
        return null;
      }
      return identity;
    },

    async markShellPrepared(
      identity: ActiveTripCacheIdentity,
      preparedAt: string
    ): Promise<boolean> {
      if (!Number.isFinite(new Date(preparedAt).getTime())) return false;
      const db = await database();
      const transaction = db.transaction(OFFLINE_IDENTITY_STORE_NAME, 'readwrite');
      const activeIdentity = await transaction.store.get(identity.projectNamespace);
      if (activeIdentity?.activeUserId !== identity.userId) {
        await transaction.done;
        return false;
      }
      await transaction.store.put({ ...activeIdentity, shellPreparedAt: preparedAt });
      await transaction.done;
      return true;
    },

    async clearOfflineIdentity(projectNamespace: string): Promise<void> {
      const db = await database();
      await db.delete(OFFLINE_IDENTITY_STORE_NAME, projectNamespace);
    },

    async close(): Promise<void> {
      if (!databasePromise) return;
      const db = await databasePromise;
      db.close();
      databasePromise = null;
    },
  };
}

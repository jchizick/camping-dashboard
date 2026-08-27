import type { DashboardData, TripMemberRole } from '@/types';
import {
  createActiveTripSnapshot,
  type ActiveTripSnapshot,
} from './activeTripSnapshot';
import {
  createIndexedDbActiveTripCache,
  type ActiveTripCacheIdentity,
  type OfflineIdentityRecord,
} from './activeTripCache';
import {
  fetchDashboardDataWithStatus,
  type RemoteDashboardLoad,
} from './fetchDashboard';
import { requiredEnvironmentVariable } from './env';
import { hasCompleteWorkspaceSources } from './workspaceSources';

export type TripRepositorySource = 'online' | 'cache';
export type TripCacheWriteOutcome = 'stored' | 'skipped-incomplete' | 'failed';
export const OFFLINE_ACCESS_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

export interface TripRepositoryResult {
  source: TripRepositorySource;
  data: DashboardData;
  cachedAt: string;
  lastOnlineVerifiedAt: string;
  verifiedRole: TripMemberRole;
  snapshotRevision: string;
  cacheWriteOutcome?: TripCacheWriteOutcome;
}

export interface LoadOnlineTripInput {
  tripId: string;
  userId: string;
  verifiedRole: TripMemberRole;
}

export interface ReadCachedTripInput {
  userId: string;
}

export type OfflineTripAccessResult =
  | {
      status: 'available';
      identity: OfflineIdentityRecord;
      workspace: TripRepositoryResult;
    }
  | {
      status:
        | 'no-identity'
        | 'no-snapshot'
        | 'wrong-trip'
        | 'expired'
        | 'shell-not-prepared';
      identity: OfflineIdentityRecord | null;
      workspace: TripRepositoryResult | null;
    };

interface TripRepositoryCache {
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

export interface CreateTripRepositoryOptions {
  projectNamespace: string;
  cache: TripRepositoryCache;
  loadRemoteTrip: (tripId: string) => Promise<RemoteDashboardLoad>;
  now?: () => string;
  createRevision?: () => string;
  logCacheError?: (message: string, error: unknown) => void;
}

export function projectNamespaceFromSupabaseUrl(value: string): string {
  const url = new URL(value);
  return `${url.protocol}//${url.host}`.toLowerCase();
}

function resultFromSnapshot(snapshot: ActiveTripSnapshot): TripRepositoryResult {
  return {
    source: 'cache',
    data: snapshot.data,
    cachedAt: snapshot.cachedAt,
    lastOnlineVerifiedAt: snapshot.lastOnlineVerifiedAt,
    verifiedRole: snapshot.verifiedRole,
    snapshotRevision: snapshot.snapshotRevision,
  };
}

export function createTripRepository(options: CreateTripRepositoryOptions) {
  const now = options.now ?? (() => new Date().toISOString());
  const createRevision =
    options.createRevision ?? (() => globalThis.crypto.randomUUID());
  const logCacheError =
    options.logCacheError ??
    ((message: string, error: unknown) => console.error(message, error));

  function identity(userId: string): ActiveTripCacheIdentity {
    return { projectNamespace: options.projectNamespace, userId };
  }

  return {
    async loadOnlineTrip(
      input: LoadOnlineTripInput
    ): Promise<TripRepositoryResult> {
      const remote = await options.loadRemoteTrip(input.tripId);
      const verifiedAt = now();
      const revision = createRevision();
      let cacheWriteOutcome: TripCacheWriteOutcome = 'skipped-incomplete';

      if (hasCompleteWorkspaceSources(remote.sourceStatus)) {
        try {
          const snapshot = createActiveTripSnapshot({
            projectNamespace: options.projectNamespace,
            userId: input.userId,
            tripId: input.tripId,
            verifiedRole: input.verifiedRole,
            cachedAt: verifiedAt,
            lastOnlineVerifiedAt: verifiedAt,
            snapshotRevision: revision,
            sourceStatus: remote.sourceStatus,
            data: remote.data,
          });
          await options.cache.replaceActiveTrip(snapshot);
          cacheWriteOutcome = 'stored';
        } catch (error) {
          cacheWriteOutcome = 'failed';
          logCacheError('[tripRepository] Active trip could not be cached.', error);
        }
      }

      return {
        source: 'online',
        data: remote.data,
        cachedAt: verifiedAt,
        lastOnlineVerifiedAt: verifiedAt,
        verifiedRole: input.verifiedRole,
        snapshotRevision: revision,
        cacheWriteOutcome,
      };
    },

    async readCachedTrip(
      input: ReadCachedTripInput
    ): Promise<TripRepositoryResult | null> {
      const snapshot = await options.cache.readActiveTrip(identity(input.userId));
      return snapshot ? resultFromSnapshot(snapshot) : null;
    },

    async readOfflineTrip(input: {
      tripId?: string;
      requirePreparedShell?: boolean;
    } = {}): Promise<OfflineTripAccessResult> {
      const offlineIdentity = await options.cache.readOfflineIdentity(
        options.projectNamespace
      );
      if (!offlineIdentity) {
        return { status: 'no-identity', identity: null, workspace: null };
      }
      const snapshot = await options.cache.readActiveTrip(
        identity(offlineIdentity.activeUserId)
      );
      if (!snapshot) {
        return {
          status: 'no-snapshot',
          identity: offlineIdentity,
          workspace: null,
        };
      }
      const workspace = resultFromSnapshot(snapshot);
      if (input.tripId && snapshot.tripId !== input.tripId) {
        return {
          status: 'wrong-trip',
          identity: offlineIdentity,
          workspace,
        };
      }
      const verifiedAt = new Date(snapshot.lastOnlineVerifiedAt).getTime();
      const currentTime = new Date(now()).getTime();
      if (
        !Number.isFinite(verifiedAt) ||
        !Number.isFinite(currentTime) ||
        currentTime < verifiedAt ||
        currentTime - verifiedAt > OFFLINE_ACCESS_MAX_AGE_MS
      ) {
        return {
          status: 'expired',
          identity: offlineIdentity,
          workspace,
        };
      }
      if (input.requirePreparedShell && !offlineIdentity.shellPreparedAt) {
        return {
          status: 'shell-not-prepared',
          identity: offlineIdentity,
          workspace,
        };
      }
      return { status: 'available', identity: offlineIdentity, workspace };
    },

    markShellPrepared(input: ReadCachedTripInput) {
      return options.cache.markShellPrepared(
        identity(input.userId),
        now()
      );
    },

    clearOfflineIdentity() {
      return options.cache.clearOfflineIdentity(options.projectNamespace);
    },

    clearCachedTrip(input: ReadCachedTripInput & { tripId: string }) {
      return options.cache.clearCachedTrip({
        ...identity(input.userId),
        tripId: input.tripId,
      });
    },

    clearUserCache(input: ReadCachedTripInput) {
      return options.cache.clearUserCache(identity(input.userId));
    },
  };
}

const supabaseUrl = requiredEnvironmentVariable(
  'NEXT_PUBLIC_SUPABASE_URL',
  process.env.NEXT_PUBLIC_SUPABASE_URL
);

export const tripRepository = createTripRepository({
  projectNamespace: projectNamespaceFromSupabaseUrl(supabaseUrl),
  cache: createIndexedDbActiveTripCache(),
  loadRemoteTrip: fetchDashboardDataWithStatus,
});

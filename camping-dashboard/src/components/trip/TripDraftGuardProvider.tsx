'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { usePathname, useRouter } from 'next/navigation';
import UnsavedChangesDialog from './UnsavedChangesDialog';

interface DraftRegistration {
  dirty: boolean;
  discard?: () => void;
}

interface GuardOptions {
  draftIds?: readonly string[];
}

interface TripDraftGuardValue {
  hasDirtyDrafts: boolean;
  registerDraft: (id: string, discard?: () => void) => () => void;
  setDraftDirty: (id: string, dirty: boolean) => void;
  clearDraft: (id: string) => void;
  requestAction: (
    action: () => void | Promise<void>,
    options?: GuardOptions
  ) => Promise<boolean>;
  requestNavigation: (href: string) => void;
}

interface PendingAction {
  action: () => void | Promise<void>;
  draftIds: string[];
  resolve: (continued: boolean) => void;
}

const TripDraftGuardContext = createContext<TripDraftGuardValue | null>(null);

export function TripDraftGuardProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const draftsRef = useRef(new Map<string, DraftRegistration>());
  const currentHrefRef = useRef('');
  const pendingActionRef = useRef<PendingAction | null>(null);
  const [dirtyDraftIds, setDirtyDraftIds] = useState<string[]>([]);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);

  const notifyRegistryChange = useCallback(() => {
    const ids: string[] = [];
    for (const [id, registration] of draftsRef.current) {
      if (registration.dirty) ids.push(id);
    }
    setDirtyDraftIds(ids);
  }, []);

  const registerDraft = useCallback(
    (id: string, discard?: () => void) => {
      const existing = draftsRef.current.get(id);
      draftsRef.current.set(id, {
        dirty: existing?.dirty ?? false,
        discard,
      });
      notifyRegistryChange();

      return () => {
        if (draftsRef.current.delete(id)) notifyRegistryChange();
      };
    },
    [notifyRegistryChange]
  );

  const setDraftDirty = useCallback(
    (id: string, dirty: boolean) => {
      const existing = draftsRef.current.get(id);
      if (!existing || existing.dirty === dirty) return;
      draftsRef.current.set(id, { ...existing, dirty });
      notifyRegistryChange();
    },
    [notifyRegistryChange]
  );

  const clearDraft = useCallback(
    (id: string) => {
      const existing = draftsRef.current.get(id);
      if (!existing?.dirty) return;
      draftsRef.current.set(id, { ...existing, dirty: false });
      notifyRegistryChange();
    },
    [notifyRegistryChange]
  );

  const requestAction = useCallback(
    async (
      action: () => void | Promise<void>,
      options?: GuardOptions
    ): Promise<boolean> => {
      const requestedIds = options?.draftIds
        ? options.draftIds.filter((id) => draftsRef.current.get(id)?.dirty)
        : Array.from(draftsRef.current)
            .filter(([, registration]) => registration.dirty)
            .map(([id]) => id);

      if (requestedIds.length === 0) {
        await action();
        return true;
      }
      if (pendingActionRef.current) return false;

      return new Promise<boolean>((resolve) => {
        const pending = { action, draftIds: requestedIds, resolve };
        pendingActionRef.current = pending;
        setPendingAction(pending);
      });
    },
    []
  );

  const requestNavigation = useCallback(
    (href: string) => {
      void requestAction(() => {
        currentHrefRef.current = href;
        router.push(href);
      });
    },
    [requestAction, router]
  );

  const stay = useCallback(() => {
    const current = pendingActionRef.current;
    pendingActionRef.current = null;
    setPendingAction(null);
    current?.resolve(false);
  }, []);

  const discardAndContinue = useCallback(async () => {
    const current = pendingActionRef.current;
    if (!current) return;

    for (const id of current.draftIds) {
      const registration = draftsRef.current.get(id);
      registration?.discard?.();
      if (registration) {
        draftsRef.current.set(id, { ...registration, dirty: false });
      }
    }
    notifyRegistryChange();
    pendingActionRef.current = null;
    setPendingAction(null);

    try {
      await current.action();
      current.resolve(true);
    } catch (error) {
      console.error('[TripDraftGuard] Approved action failed', error);
      current.resolve(false);
    }
  }, [notifyRegistryChange]);

  useEffect(() => {
    if (dirtyDraftIds.length === 0) return;

    function warnBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = '';
    }

    window.addEventListener('beforeunload', warnBeforeUnload);
    return () => window.removeEventListener('beforeunload', warnBeforeUnload);
  }, [dirtyDraftIds.length]);

  useEffect(() => {
    currentHrefRef.current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  }, [pathname]);

  useEffect(() => {
    if (dirtyDraftIds.length === 0) return;

    function guardHistoryNavigation() {
      const targetHref = `${window.location.pathname}${window.location.search}${window.location.hash}`;
      const currentHref = currentHrefRef.current;
      if (!currentHref || targetHref === currentHref) return;

      router.replace(currentHref);
      void requestAction(() => {
        currentHrefRef.current = targetHref;
        router.push(targetHref);
      });
    }

    window.addEventListener('popstate', guardHistoryNavigation);
    return () => window.removeEventListener('popstate', guardHistoryNavigation);
  }, [dirtyDraftIds.length, requestAction, router]);

  const value = useMemo<TripDraftGuardValue>(
    () => ({
      hasDirtyDrafts: dirtyDraftIds.length > 0,
      registerDraft,
      setDraftDirty,
      clearDraft,
      requestAction,
      requestNavigation,
    }),
    [
      clearDraft,
      dirtyDraftIds.length,
      registerDraft,
      requestAction,
      requestNavigation,
      setDraftDirty,
    ]
  );

  return (
    <TripDraftGuardContext.Provider value={value}>
      {children}
      <UnsavedChangesDialog
        isOpen={pendingAction !== null}
        dirtyCount={pendingAction?.draftIds.length ?? 0}
        onStay={stay}
        onDiscard={() => void discardAndContinue()}
      />
    </TripDraftGuardContext.Provider>
  );
}

export function useTripDraftGuard() {
  const context = useContext(TripDraftGuardContext);
  if (!context) {
    throw new Error(
      'useTripDraftGuard must be used within a TripDraftGuardProvider'
    );
  }
  return context;
}

export function useOptionalTripDraftGuard() {
  return useContext(TripDraftGuardContext);
}

'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
} from 'react';

export const PHONE_LAYOUT_MEDIA_QUERY = [
  '(max-width: 767px)',
  '(orientation: landscape) and (max-width: 956px) and (max-height: 600px) and (pointer: coarse)',
].join(', ');

const PhoneLayoutContext = createContext<boolean | null>(null);

function subscribeToPhoneLayout(
  mediaQuery: MediaQueryList | null,
  onChange: () => void
) {
  if (!mediaQuery) return () => {};
  mediaQuery.addEventListener('change', onChange);
  return () => mediaQuery.removeEventListener('change', onChange);
}

export function PhoneLayoutProvider({ children }: { children: React.ReactNode }) {
  const mediaQuery = useMemo(
    () =>
      typeof window !== 'undefined' && window.matchMedia
        ? window.matchMedia(PHONE_LAYOUT_MEDIA_QUERY)
        : null,
    []
  );
  const subscribe = useCallback(
    (onChange: () => void) => subscribeToPhoneLayout(mediaQuery, onChange),
    [mediaQuery]
  );
  const getSnapshot = useCallback(
    () => mediaQuery?.matches ?? false,
    [mediaQuery]
  );
  const isPhoneLayout = useSyncExternalStore(
    subscribe,
    getSnapshot,
    () => false
  );

  useEffect(() => {
    const root = document.documentElement;
    if (isPhoneLayout) root.setAttribute('data-phone-layout', 'true');
    else root.removeAttribute('data-phone-layout');

    return () => root.removeAttribute('data-phone-layout');
  }, [isPhoneLayout]);

  return (
    <PhoneLayoutContext.Provider value={isPhoneLayout}>
      {children}
    </PhoneLayoutContext.Provider>
  );
}

export function usePhoneLayout() {
  const isPhoneLayout = useContext(PhoneLayoutContext);
  if (isPhoneLayout === null) {
    throw new Error('usePhoneLayout must be used within PhoneLayoutProvider');
  }
  return isPhoneLayout;
}

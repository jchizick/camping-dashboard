'use client';

import { useEffect, type RefObject } from 'react';

const focusableSelector =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), video[controls], [tabindex]:not([tabindex="-1"])';

let overlayLockCount = 0;
let previousBodyOverflow = '';

function acquirePageLock() {
  const appShell = document.querySelector<HTMLElement>('[data-trip-app-shell]');
  if (overlayLockCount === 0) {
    previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    if (appShell) appShell.inert = true;
  }
  overlayLockCount += 1;

  return () => {
    overlayLockCount = Math.max(0, overlayLockCount - 1);
    if (overlayLockCount === 0) {
      document.body.style.overflow = previousBodyOverflow;
      if (appShell) appShell.inert = false;
    }
  };
}
export function useOverlayDialog(
  isOpen: boolean,
  containerRef: RefObject<HTMLElement | null>,
  initialFocusRef?: RefObject<HTMLElement | null>
) {
  useEffect(() => {
    if (!isOpen) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    const releasePageLock = acquirePageLock();
    const frame = window.requestAnimationFrame(() => {
      const initialFocus =
        initialFocusRef?.current ??
        containerRef.current?.querySelector<HTMLElement>(focusableSelector) ??
        containerRef.current;
      initialFocus?.focus();
    });

    function trapFocus(event: KeyboardEvent) {
      if (event.key !== 'Tab' || !containerRef.current) return;
      const focusable = Array.from(
        containerRef.current.querySelectorAll<HTMLElement>(focusableSelector)
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', trapFocus);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener('keydown', trapFocus);
      releasePageLock();
      previousFocus?.focus();
    };
  }, [containerRef, initialFocusRef, isOpen]);
}

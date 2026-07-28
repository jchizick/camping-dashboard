'use client';

import { useCallback, useEffect, useRef } from 'react';
import { useOptionalTripDraftGuard } from './TripDraftGuardProvider';

export function draftValuesEqual(left: unknown, right: unknown) {
  return JSON.stringify(left) === JSON.stringify(right);
}

interface TripDraftFormOptions {
  id: string;
  isOpen: boolean;
  isDirty: boolean;
  onClose: () => void;
  onDiscard?: () => void;
}

export function useTripDraftForm({
  id,
  isOpen,
  isDirty,
  onClose,
  onDiscard,
}: TripDraftFormOptions) {
  const draftGuard = useOptionalTripDraftGuard();
  const registerDraft = draftGuard?.registerDraft;
  const setDraftDirty = draftGuard?.setDraftDirty;
  const clearDraft = draftGuard?.clearDraft;
  const requestAction = draftGuard?.requestAction;
  const discardRef = useRef(onDiscard);

  useEffect(() => {
    discardRef.current = onDiscard;
  }, [onDiscard]);

  useEffect(() => {
    if (!isOpen) return;
    return registerDraft?.(id, () => discardRef.current?.());
  }, [id, isOpen, registerDraft]);

  useEffect(() => {
    if (!isOpen) return;
    setDraftDirty?.(id, isDirty);
  }, [id, isDirty, isOpen, setDraftDirty]);

  const close = useCallback(() => {
    if (!requestAction || !clearDraft) {
      onClose();
      return;
    }
    void requestAction(
      () => {
        clearDraft(id);
        onClose();
      },
      { draftIds: [id] }
    );
  }, [clearDraft, id, onClose, requestAction]);

  const saved = useCallback(() => {
    clearDraft?.(id);
  }, [clearDraft, id]);

  return { close, saved };
}

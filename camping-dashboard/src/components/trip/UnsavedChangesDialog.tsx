'use client';

import React, { useEffect, useRef } from 'react';
import { AlertTriangle } from 'lucide-react';
import { createPortal } from 'react-dom';
import { useOverlayDialog } from '@/components/ui/useOverlayDialog';

interface UnsavedChangesDialogProps {
  isOpen: boolean;
  dirtyCount: number;
  onStay: () => void;
  onDiscard: () => void;
}

export default function UnsavedChangesDialog({
  isOpen,
  dirtyCount,
  onStay,
  onDiscard,
}: UnsavedChangesDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const stayButtonRef = useRef<HTMLButtonElement>(null);
  useOverlayDialog(isOpen, dialogRef, stayButtonRef);

  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        onStay();
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onStay]);

  if (!isOpen) return null;

  return createPortal(
    <div className="trip-draft-dialog" role="presentation">
      <div className="trip-draft-dialog__backdrop" aria-hidden="true" />
      <div
        ref={dialogRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="trip-draft-dialog-title"
        aria-describedby="trip-draft-dialog-description"
        className="trip-draft-dialog__panel"
      >
        <div className="flex items-start gap-3">
          <span className="rounded-full bg-accent-yellow/15 p-2 text-accent-yellow">
            <AlertTriangle size={20} aria-hidden="true" />
          </span>
          <div>
            <h2
              id="trip-draft-dialog-title"
              className="text-lg font-semibold text-text-main"
            >
              Discard unsaved changes?
            </h2>
            <p
              id="trip-draft-dialog-description"
              className="mt-2 text-sm leading-6 text-text-muted"
            >
              {dirtyCount > 1
                ? `${dirtyCount} open forms have unsaved changes.`
                : 'This form has unsaved changes.'}{' '}
              They will be lost if you continue.
            </p>
          </div>
        </div>
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            ref={stayButtonRef}
            type="button"
            onClick={onStay}
            className="inline-flex min-h-11 items-center justify-center rounded-lg border border-border-subtle px-4 text-sm font-semibold text-text-main hover:bg-card-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
          >
            Stay and continue editing
          </button>
          <button
            type="button"
            onClick={onDiscard}
            className="inline-flex min-h-11 items-center justify-center rounded-lg bg-accent-red px-4 text-sm font-semibold text-white hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
          >
            Discard changes and continue
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

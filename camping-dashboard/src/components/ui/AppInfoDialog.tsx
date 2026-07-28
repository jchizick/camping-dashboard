'use client';

import React, { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { useOverlayDialog } from './useOverlayDialog';

interface AppInfoDialogProps {
  isOpen: boolean;
  onClose: () => void;
  eyebrow: string;
  title: string;
  description: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: 'standard' | 'wide';
}

export default function AppInfoDialog({
  isOpen,
  onClose,
  eyebrow,
  title,
  description,
  children,
  footer,
  size = 'standard',
}: AppInfoDialogProps) {
  const panelRef = useRef<HTMLElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useOverlayDialog(isOpen, panelRef, closeButtonRef);

  useEffect(() => {
    if (!isOpen) return;

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }

    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return createPortal(
    <div className="app-info-dialog" role="presentation">
      <div
        className="app-info-dialog__backdrop"
        aria-hidden="true"
        onClick={onClose}
        data-testid="app-info-dialog-backdrop"
      />
      <section
        ref={panelRef}
        className={`app-info-dialog__panel app-info-dialog__panel--${size}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        tabIndex={-1}
      >
        <header className="app-info-dialog__header">
          <div className="min-w-0">
            <p className="app-info-dialog__eyebrow">{eyebrow}</p>
            <h2 id={titleId} className="app-info-dialog__title">
              {title}
            </h2>
            <p id={descriptionId} className="app-info-dialog__description">
              {description}
            </p>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            className="app-info-dialog__close"
            aria-label={`Close ${title}`}
          >
            <X size={20} aria-hidden="true" />
          </button>
        </header>

        <div className="app-info-dialog__content">{children}</div>

        {footer ? <footer className="app-info-dialog__footer">{footer}</footer> : null}
      </section>
    </div>,
    document.body
  );
}

'use client';

import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useOverlayDialog } from './useOverlayDialog';

interface CrudSheetProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    children: React.ReactNode;
    panelClassName?: string;
}

export default function CrudSheet({ isOpen, onClose, title, children, panelClassName = '' }: CrudSheetProps) {
    const panelRef = useRef<HTMLDivElement>(null);
    const titleId = React.useId();
    useOverlayDialog(isOpen, panelRef);

    useEffect(() => {
        if (!isOpen) return;

        function onKey(event: KeyboardEvent) {
            if (event.key === 'Escape') {
                event.preventDefault();
                onClose();
            }
        }
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    // Portal to document.body so position:fixed is always relative to the
    // viewport — not to any ancestor with backdrop-filter or transform,
    // both of which create a new CSS stacking context that breaks fixed positioning.
    return createPortal(
        <div
            className="crud-sheet"
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
        >
            {/* Backdrop */}
            <div
                className="crud-sheet__overlay"
                onClick={onClose}
                aria-hidden="true"
            />

            {/* Panel */}
            <div
                className={`crud-sheet__panel ${panelClassName}`}
                ref={panelRef}
                tabIndex={-1}
            >
                <div className="crud-sheet__header">
                    <h2 id={titleId} className="crud-sheet__title">{title}</h2>
                    <button
                        className="crud-sheet__close"
                        onClick={onClose}
                        aria-label="Close panel"
                    >
                        ✕
                    </button>
                </div>

                <div className="crud-sheet__body">
                    {children}
                </div>
            </div>
        </div>,
        document.body
    );
}

'use client';

import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

interface CrudSheetProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    children: React.ReactNode;
}

export default function CrudSheet({ isOpen, onClose, title, children }: CrudSheetProps) {
    const panelRef = useRef<HTMLDivElement>(null);

    // Close on Escape key
    useEffect(() => {
        function onKey(e: KeyboardEvent) {
            if (e.key === 'Escape') onClose();
        }
        if (isOpen) document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [isOpen, onClose]);

    // Trap scroll behind overlay
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => { document.body.style.overflow = ''; };
    }, [isOpen]);

    // Focus panel when open
    useEffect(() => {
        if (isOpen && panelRef.current) {
            panelRef.current.focus();
        }
    }, [isOpen]);

    if (!isOpen) return null;

    // Portal to document.body so position:fixed is always relative to the
    // viewport — not to any ancestor with backdrop-filter or transform,
    // both of which create a new CSS stacking context that breaks fixed positioning.
    return createPortal(
        <div className="crud-sheet" role="dialog" aria-modal="true" aria-label={title}>
            {/* Backdrop */}
            <div
                className="crud-sheet__overlay"
                onClick={onClose}
                aria-hidden="true"
            />

            {/* Panel */}
            <div
                className="crud-sheet__panel"
                ref={panelRef}
                tabIndex={-1}
            >
                <div className="crud-sheet__header">
                    <h3 className="crud-sheet__title">{title}</h3>
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

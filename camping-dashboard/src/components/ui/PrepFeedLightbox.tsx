'use client';

import React, { useEffect, useRef, useCallback } from 'react';
import type { PrepFeedItem, PrepFeedCategory } from '@/types';
import { X, ChevronLeft, ChevronRight, Camera, Clock, User } from 'lucide-react';

// ── Category colors (match the badge variants) ──────────────
const CATEGORY_COLOR: Record<PrepFeedCategory, string> = {
    'Gear': '#eab308',
    'Food': '#22c55e',
    'Shelter': '#3b82f6',
    'Cook Kit': '#eab308',
    'Route': '#3b82f6',
    'Campsite': '#22c55e',
    'Misc': '#9ca3af',
};

// ── Relative time helper ────────────────────────────────────
function timeAgo(dateStr: string): string {
    const now = Date.now();
    const then = new Date(dateStr).getTime();
    const diff = Math.max(0, now - then);
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days < 7) return `${days}d ago`;
    return new Date(dateStr).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' });
}

interface PrepFeedLightboxProps {
    items: PrepFeedItem[];
    currentIndex: number;
    onClose: () => void;
    onNavigate: (index: number) => void;
}

export default function PrepFeedLightbox({ items, currentIndex, onClose, onNavigate }: PrepFeedLightboxProps) {
    const backdropRef = useRef<HTMLDivElement>(null);
    const item = items[currentIndex];

    const hasPrev = currentIndex > 0;
    const hasNext = currentIndex < items.length - 1;

    const goPrev = useCallback(() => {
        if (hasPrev) onNavigate(currentIndex - 1);
    }, [hasPrev, currentIndex, onNavigate]);

    const goNext = useCallback(() => {
        if (hasNext) onNavigate(currentIndex + 1);
    }, [hasNext, currentIndex, onNavigate]);

    // Keyboard: Escape, ArrowLeft, ArrowRight
    useEffect(() => {
        function handler(e: KeyboardEvent) {
            if (e.key === 'Escape') onClose();
            else if (e.key === 'ArrowLeft') goPrev();
            else if (e.key === 'ArrowRight') goNext();
        }
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [onClose, goPrev, goNext]);

    // Lock body scroll
    useEffect(() => {
        document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = ''; };
    }, []);

    if (!item) return null;

    const catColor = CATEGORY_COLOR[item.category] || '#9ca3af';

    return (
        <div
            ref={backdropRef}
            role="dialog"
            aria-modal="true"
            aria-label="Field Prep Feed Lightbox"
            className="lightbox-backdrop"
            onClick={(e) => { if (e.target === backdropRef.current) onClose(); }}
        >
            <div className="lightbox-panel">

                {/* Header */}
                <div className="lightbox-header">
                    <div className="lightbox-header-left">
                        <span className="lightbox-pip" />
                        <span className="lightbox-label">
                            <Camera size={14} style={{ display: 'inline', verticalAlign: '-2px', marginRight: '6px' }} />
                            FIELD PREP FEED
                        </span>
                        <span className="lightbox-counter">
                            {currentIndex + 1} / {items.length}
                        </span>
                    </div>
                    <button
                        onClick={onClose}
                        className="lightbox-close"
                        aria-label="Close lightbox"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Image area */}
                <div className="lightbox-image-wrap">
                    {/* Prev button */}
                    {hasPrev && (
                        <button
                            onClick={goPrev}
                            className="lightbox-nav lightbox-nav--prev"
                            aria-label="Previous image"
                        >
                            <ChevronLeft size={24} />
                        </button>
                    )}

                    <img
                        src={item.image_url}
                        alt={item.caption || item.category}
                        className="lightbox-image"
                    />

                    {/* Next button */}
                    {hasNext && (
                        <button
                            onClick={goNext}
                            className="lightbox-nav lightbox-nav--next"
                            aria-label="Next image"
                        >
                            <ChevronRight size={24} />
                        </button>
                    )}
                </div>

                {/* Metadata footer */}
                <div className="lightbox-meta">
                    <div className="lightbox-meta-top">
                        <span className="lightbox-category" style={{ color: catColor, borderColor: catColor }}>
                            {item.category}
                        </span>
                        {item.caption && (
                            <p className="lightbox-caption">{item.caption}</p>
                        )}
                    </div>
                    <div className="lightbox-meta-bottom">
                        <span className="lightbox-meta-item">
                            <User size={11} /> {item.uploaded_by}
                        </span>
                        <span className="lightbox-meta-item">
                            <Clock size={11} /> {timeAgo(item.created_at)}
                        </span>
                        <span className="lightbox-meta-hint">
                            <kbd className="lightbox-kbd">←</kbd>
                            <kbd className="lightbox-kbd">→</kbd> navigate · <kbd className="lightbox-kbd">ESC</kbd> close
                        </span>
                    </div>
                </div>
            </div>

            <style>{`
                .lightbox-backdrop {
                    position: fixed;
                    inset: 0;
                    z-index: 9999;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    background: rgba(10, 9, 8, 0.88);
                    backdrop-filter: blur(12px);
                    -webkit-backdrop-filter: blur(12px);
                    animation: lbFadeIn 0.2s ease;
                    padding: 1rem;
                }

                @keyframes lbFadeIn {
                    from { opacity: 0; }
                    to   { opacity: 1; }
                }

                .lightbox-panel {
                    width: 100%;
                    max-width: 900px;
                    max-height: 92vh;
                    background: rgba(22, 20, 16, 0.95);
                    border: 1px solid rgba(234, 179, 8, 0.2);
                    border-radius: 12px;
                    overflow: hidden;
                    box-shadow:
                        0 0 0 1px rgba(234, 179, 8, 0.08),
                        0 30px 80px rgba(0, 0, 0, 0.7),
                        0 0 60px rgba(234, 179, 8, 0.04);
                    animation: lbSlideUp 0.25s cubic-bezier(0.22, 1, 0.36, 1);
                    display: flex;
                    flex-direction: column;
                }

                @keyframes lbSlideUp {
                    from { opacity: 0; transform: translateY(24px) scale(0.97); }
                    to   { opacity: 1; transform: translateY(0)   scale(1);    }
                }

                /* ── Header ──────────────────────────── */
                .lightbox-header {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 0.875rem 1.25rem;
                    border-bottom: 1px solid rgba(234, 179, 8, 0.12);
                    background: rgba(234, 179, 8, 0.04);
                    flex-shrink: 0;
                }

                .lightbox-header-left {
                    display: flex;
                    align-items: center;
                    gap: 0.625rem;
                }

                .lightbox-pip {
                    display: inline-block;
                    width: 7px;
                    height: 7px;
                    border-radius: 50%;
                    background: #eab308;
                    box-shadow: 0 0 8px 2px rgba(234, 179, 8, 0.5);
                    animation: lbPip 2s ease-in-out infinite;
                }

                @keyframes lbPip {
                    0%, 100% { opacity: 1; box-shadow: 0 0 8px 2px rgba(234, 179, 8, 0.5); }
                    50%       { opacity: 0.5; box-shadow: 0 0 4px 1px rgba(234, 179, 8, 0.2); }
                }

                .lightbox-label {
                    font-family: 'JetBrains Mono', 'Courier New', monospace;
                    font-size: 0.7rem;
                    font-weight: 700;
                    letter-spacing: 0.18em;
                    text-transform: uppercase;
                    color: #eab308;
                }

                .lightbox-counter {
                    font-family: 'JetBrains Mono', 'Courier New', monospace;
                    font-size: 0.65rem;
                    letter-spacing: 0.12em;
                    text-transform: uppercase;
                    color: rgba(243, 244, 246, 0.35);
                }

                .lightbox-close {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    width: 32px;
                    height: 32px;
                    border-radius: 6px;
                    background: transparent;
                    border: 1px solid rgba(234, 179, 8, 0.2);
                    color: rgba(243, 244, 246, 0.5);
                    cursor: pointer;
                    transition: all 0.15s ease;
                }

                .lightbox-close:hover {
                    background: rgba(234, 179, 8, 0.1);
                    border-color: rgba(234, 179, 8, 0.5);
                    color: #eab308;
                }

                /* ── Image area ──────────────────────── */
                .lightbox-image-wrap {
                    position: relative;
                    width: 100%;
                    background: #0a0a08;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    min-height: 200px;
                    flex: 1;
                    overflow: hidden;
                }

                .lightbox-image {
                    display: block;
                    max-width: 100%;
                    max-height: 65vh;
                    object-fit: contain;
                    animation: lbImgFade 0.2s ease;
                }

                @keyframes lbImgFade {
                    from { opacity: 0; transform: scale(0.98); }
                    to   { opacity: 1; transform: scale(1); }
                }

                /* ── Nav buttons ─────────────────────── */
                .lightbox-nav {
                    position: absolute;
                    top: 50%;
                    transform: translateY(-50%);
                    width: 44px;
                    height: 44px;
                    border-radius: 8px;
                    background: rgba(22, 20, 16, 0.7);
                    border: 1px solid rgba(234, 179, 8, 0.15);
                    color: rgba(243, 244, 246, 0.6);
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: all 0.15s ease;
                    z-index: 2;
                }

                .lightbox-nav:hover {
                    background: rgba(234, 179, 8, 0.12);
                    border-color: rgba(234, 179, 8, 0.5);
                    color: #eab308;
                }

                .lightbox-nav--prev { left: 0.75rem; }
                .lightbox-nav--next { right: 0.75rem; }

                /* ── Metadata footer ─────────────────── */
                .lightbox-meta {
                    padding: 0.875rem 1.25rem;
                    border-top: 1px solid rgba(234, 179, 8, 0.08);
                    flex-shrink: 0;
                }

                .lightbox-meta-top {
                    display: flex;
                    align-items: flex-start;
                    gap: 0.75rem;
                    margin-bottom: 0.5rem;
                }

                .lightbox-category {
                    font-family: 'JetBrains Mono', 'Courier New', monospace;
                    font-size: 0.6rem;
                    font-weight: 700;
                    letter-spacing: 0.15em;
                    text-transform: uppercase;
                    padding: 2px 8px;
                    border: 1px solid;
                    border-radius: 4px;
                    white-space: nowrap;
                    flex-shrink: 0;
                    opacity: 0.9;
                }

                .lightbox-caption {
                    font-size: 0.875rem;
                    color: rgba(243, 244, 246, 0.85);
                    line-height: 1.5;
                    margin: 0;
                }

                .lightbox-meta-bottom {
                    display: flex;
                    align-items: center;
                    gap: 1rem;
                    flex-wrap: wrap;
                }

                .lightbox-meta-item {
                    font-family: 'JetBrains Mono', 'Courier New', monospace;
                    font-size: 0.65rem;
                    color: rgba(243, 244, 246, 0.4);
                    letter-spacing: 0.08em;
                    text-transform: uppercase;
                    display: inline-flex;
                    align-items: center;
                    gap: 4px;
                }

                .lightbox-meta-hint {
                    font-family: 'JetBrains Mono', 'Courier New', monospace;
                    font-size: 0.6rem;
                    color: rgba(243, 244, 246, 0.2);
                    letter-spacing: 0.06em;
                    margin-left: auto;
                    display: inline-flex;
                    align-items: center;
                    gap: 3px;
                }

                .lightbox-kbd {
                    display: inline-block;
                    padding: 0 4px;
                    border: 1px solid rgba(243, 244, 246, 0.2);
                    border-radius: 3px;
                    font-size: 0.6rem;
                    background: rgba(243, 244, 246, 0.05);
                    color: inherit;
                    line-height: 1.6;
                }
            `}</style>
        </div>
    );
}

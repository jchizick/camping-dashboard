'use client';

import React, { useEffect, useRef } from 'react';
import { X, Radio } from 'lucide-react';

const MISSION_BRIEF_URL =
  'https://jeelonevfpoifdci.public.blob.vercel-storage.com/mission-brief-v2.mp4';

interface MissionBriefModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function MissionBriefModal({ isOpen, onClose }: MissionBriefModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);

  // Play on open, pause/reset on close
  useEffect(() => {
    if (!videoRef.current) return;
    if (isOpen) {
      videoRef.current.currentTime = 0;
      videoRef.current.play().catch(() => {/* autoplay blocked — user can press play */});
    } else {
      videoRef.current.pause();
    }
  }, [isOpen]);

  // ESC to close
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  // Lock body scroll while open
  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      ref={backdropRef}
      id="mission-brief-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="Mission Brief Video"
      className="mission-brief-backdrop"
      onClick={(e) => { if (e.target === backdropRef.current) onClose(); }}
    >
      <div className="mission-brief-panel">

        {/* Header */}
        <div className="mission-brief-header">
          <div className="mission-brief-header-left">
            <span className="mission-brief-pip" />
            <span className="mission-brief-label inline-flex items-center gap-2">
              <Radio size={14} />
              MISSION BRIEF
            </span>
            <span className="mission-brief-sub">ALGONQUIN · MAPLE LAKE · SITE 4</span>
          </div>
          <button
            id="mission-brief-close-btn"
            onClick={onClose}
            className="mission-brief-close"
            aria-label="Close mission brief"
          >
            <X size={18} />
          </button>
        </div>

        {/* Video */}
        <div className="mission-brief-video-wrap">
          <video
            ref={videoRef}
            src={MISSION_BRIEF_URL}
            controls
            playsInline
            className="mission-brief-video"
          />
        </div>

        {/* Footer */}
        <div className="mission-brief-footer">
          <span className="mission-brief-footer-text">
            Press <kbd className="mission-brief-kbd">ESC</kbd> or click outside to close
          </span>
        </div>
      </div>

      <style>{`
        .mission-brief-backdrop {
          position: fixed;
          inset: 0;
          z-index: 9999;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(10, 9, 8, 0.88);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          animation: mbFadeIn 0.2s ease;
          padding: 1rem;
        }

        @keyframes mbFadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }

        .mission-brief-panel {
          width: 100%;
          max-width: 900px;
          background: rgba(22, 20, 16, 0.95);
          border: 1px solid rgba(234, 179, 8, 0.2);
          border-radius: 12px;
          overflow: hidden;
          box-shadow:
            0 0 0 1px rgba(234, 179, 8, 0.08),
            0 30px 80px rgba(0, 0, 0, 0.7),
            0 0 60px rgba(234, 179, 8, 0.04);
          animation: mbSlideUp 0.25s cubic-bezier(0.22, 1, 0.36, 1);
          display: flex;
          flex-direction: column;
        }

        @keyframes mbSlideUp {
          from { opacity: 0; transform: translateY(24px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0)   scale(1);    }
        }

        .mission-brief-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0.875rem 1.25rem;
          border-bottom: 1px solid rgba(234, 179, 8, 0.12);
          background: rgba(234, 179, 8, 0.04);
        }

        .mission-brief-header-left {
          display: flex;
          align-items: center;
          gap: 0.625rem;
        }

        .mission-brief-pip {
          display: inline-block;
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: #eab308;
          box-shadow: 0 0 8px 2px rgba(234, 179, 8, 0.5);
          animation: mbPip 2s ease-in-out infinite;
        }

        @keyframes mbPip {
          0%, 100% { opacity: 1; box-shadow: 0 0 8px 2px rgba(234, 179, 8, 0.5); }
          50%       { opacity: 0.5; box-shadow: 0 0 4px 1px rgba(234, 179, 8, 0.2); }
        }

        .mission-brief-label {
          font-family: 'JetBrains Mono', 'Courier New', monospace;
          font-size: 0.7rem;
          font-weight: 700;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          color: #eab308;
        }

        .mission-brief-sub {
          font-family: 'JetBrains Mono', 'Courier New', monospace;
          font-size: 0.65rem;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: rgba(243, 244, 246, 0.35);
        }

        .mission-brief-close {
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

        .mission-brief-close:hover {
          background: rgba(234, 179, 8, 0.1);
          border-color: rgba(234, 179, 8, 0.5);
          color: #eab308;
        }

        .mission-brief-video-wrap {
          position: relative;
          width: 100%;
          background: #000;
          line-height: 0;
        }

        .mission-brief-video {
          width: 100%;
          display: block;
          max-height: 70vh;
          object-fit: contain;
          background: #000;
        }

        .mission-brief-footer {
          padding: 0.6rem 1.25rem;
          display: flex;
          justify-content: flex-end;
          border-top: 1px solid rgba(234, 179, 8, 0.08);
        }

        .mission-brief-footer-text {
          font-family: 'JetBrains Mono', 'Courier New', monospace;
          font-size: 0.65rem;
          color: rgba(243, 244, 246, 0.25);
          letter-spacing: 0.06em;
        }

        .mission-brief-kbd {
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

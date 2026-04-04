'use client';

import React, { useEffect, useRef } from 'react';
import { X, FileText } from 'lucide-react';

const PROJECT_INTEL_TEXT = `
# 🧭 Camping Dashboard — Tools & Technology Stack

The Camping Dashboard was built as a modern, production-grade web application, combining a strong frontend architecture, real-time data systems, and a structured backend.

---

## ⚙️ Core Framework & Language
At the foundation, the app is powered by:
- **Next.js (App Router)** – Handles routing, server-side rendering, and API endpoints
- **React 19** – Component-based UI for building an interactive dashboard
- **TypeScript** – Enforces type safety, improves scalability, and reduces runtime errors

This combination provides a fast, scalable, and maintainable frontend architecture.

---

## 🎨 UI, Styling & Design System
The visual layer was engineered for a modern “mission control” experience:
- **Tailwind CSS (v4)** – Utility-first styling for rapid, consistent UI development
- **CSS Variables** – Dynamic theming (Day/Night modes) with centralized color control
- **Lucide React** – Clean, scalable icon system
- **Custom SVG Filters** – Used to generate topographic-style textures and map effects

This allowed for precise control over layout, responsiveness, and aesthetic consistency.

---

## 🗺️ Mapping & Visualization
To support location-based planning:
- **Leaflet + React-Leaflet** – Interactive maps with route plotting, markers, and terrain visualization
- **MapTiler SDK** – Advanced vector tile rendering and custom map styling

This powers the spatial awareness layer of the dashboard.

---

## 🧠 Logic, Calculations & System Design
The “brains” of the application were designed with strict separation of concerns:
- **Dedicated helper functions** (\`lib/helpers.ts\`) for all calculations
- **Readiness Engine** – A weighted scoring system evaluating:
    - Gear completeness
    - Meal planning
    - Safety readiness
    - Weather preparedness
    - Timeline completion
- **Time-based logic** – Auto-switching Day/Night mode based on sunrise/sunset data

This ensures the UI remains clean while logic stays modular and reusable.

---

## 🗄️ Backend & Data Layer
The backend is built using a modern BaaS approach:
- **Supabase (PostgreSQL)** – Primary database and backend
- **Structured relational schema**:
    - \`trips\`
    - \`gear_items\`
    - \`meals\`
    - \`timeline_events\`
    - \`crew_members\`
    - \`weather data\`
- **Supabase JS + SSR clients** – Secure data access and integration
- **Modal (planned)** – For scheduled background jobs (e.g., weather syncing)

This enables real-time data handling with minimal backend overhead.

---

## 🔄 CRUD Operations & Data Flow
The app supports full data lifecycle management:
- **Create / Update** – Slide-out panel forms for seamless in-dashboard editing
- **Read** – Initially powered by structured mock data, later replaced with live Supabase queries
- **Delete** – Managed through controlled UI interactions

**Key principle**: UI components do not handle data fetching directly — data is abstracted for clean architecture.

---

## 🚀 Deployment & DevOps
The app is deployed and managed using:
- **Vercel** – Optimized hosting for Next.js with automatic deployments
- **Vercel Cron Jobs** – Scheduled data refresh (e.g., weather updates)
- **ESLint** – Code quality and consistency enforcement

---

## 🧪 Version Control & Workflow
A disciplined development workflow was used:
- **Git & GitHub**
- **Incremental, descriptive commits**
- **Feature iteration via branches**
- **Safe rollback and version tracking**
- **CI/CD via Vercel** (Every push → automatic build → live deployment)

---

## 🏗️ System Architecture (A.N.T. Model)
The project follows a structured system design:
- **Layer 1 — Architecture**: Rules, schemas, and system logic (\`gemini.md\` “constitution”)
- **Layer 2 — Application**: Next.js frontend + UI components
- **Layer 3 — Tools**: Background jobs, APIs, and automation (weather, alerts, etc.)

This creates a scalable, modular system rather than a one-off app.

---

## ⚡ Summary
The Camping Dashboard is not just a UI project — it’s a full-stack system combining:
- Modern frontend architecture (Next.js + React + TypeScript)
- Structured backend (Supabase)
- Real-time data + automation
- Clean separation of logic, UI, and data
- Production-ready deployment pipeline
`;

interface ProjectIntelModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ProjectIntelModal({ isOpen, onClose }: ProjectIntelModalProps) {
  const backdropRef = useRef<HTMLDivElement>(null);

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
      aria-label="Project Intel"
      className="mission-brief-backdrop"
      onClick={(e) => { if (e.target === backdropRef.current) onClose(); }}
    >
      <div className="mission-brief-panel" style={{ height: '80vh' }}>

        {/* Header */}
        <div className="mission-brief-header">
          <div className="mission-brief-header-left">
            <span className="mission-brief-pip" />
            <span className="mission-brief-label inline-flex items-center gap-2">
              <FileText size={14} />
              PROJECT INTEL
            </span>
            <span className="mission-brief-sub">ARCHITECTURE · TOOLS · TECH STACK</span>
          </div>
          <button
            id="mission-brief-close-btn"
            onClick={onClose}
            className="mission-brief-close"
            aria-label="Close project intel"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="mission-brief-content-wrap flex-1 overflow-y-auto p-6 scrollbar-custom">
          <div className="prose prose-invert prose-sm max-w-none font-mono text-[13px] leading-relaxed text-text-muted whitespace-pre-wrap">
            {PROJECT_INTEL_TEXT}
          </div>
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
        
        .scrollbar-custom::-webkit-scrollbar {
          width: 6px;
        }
        .scrollbar-custom::-webkit-scrollbar-track {
          background: rgba(0,0,0,0.2);
        }
        .scrollbar-custom::-webkit-scrollbar-thumb {
          background: rgba(234, 179, 8, 0.2);
          border-radius: 3px;
        }
        .scrollbar-custom::-webkit-scrollbar-thumb:hover {
          background: rgba(234, 179, 8, 0.4);
        }

        .mission-brief-footer {
          padding: 0.6rem 1.25rem;
          display: flex;
          justify-content: flex-end;
          border-top: 1px solid rgba(234, 179, 8, 0.08);
          margin-top: auto;
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

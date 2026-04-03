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
- **Dedicated helper functions** (`lib/helpers.ts`) for all calculations
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
    - `trips`
    - `gear_items`
    - `meals`
    - `timeline_events`
    - `crew_members`
    - `weather data`
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
- **Layer 1 — Architecture**: Rules, schemas, and system logic (`gemini.md` “constitution”)
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

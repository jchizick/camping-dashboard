'use client';

import React from 'react';
import AppInfoDialog from './AppInfoDialog';

interface ProjectIntelModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const ABOUT_SECTIONS = [
  {
    title: 'Application foundation',
    items: [
      'Next.js App Router and React 19 for the route-based workspace',
      'TypeScript for typed data, components, and server boundaries',
      'Shared trip workspace state so section routes use one coordinated load',
    ],
  },
  {
    title: 'Experience and mapping',
    items: [
      'Tailwind CSS and semantic CSS variables for expedition and clean day/night themes',
      'Lucide icons and responsive navigation built for desktop, tablet, and mobile',
      'MapTiler vector maps for campsite context, markers, and map controls',
    ],
  },
  {
    title: 'Data and access',
    items: [
      'Supabase Postgres with browser and server clients',
      'Email/password sessions with owner, editor, and viewer permissions',
      'Row-level security as the database authorization boundary',
    ],
  },
  {
    title: 'Planning workspace',
    items: [
      'Dedicated Home, Plan, Gear, Crew, Guide, and Field Log routes',
      'Readiness, weather, timeline, meal, gear, and field-reference tools',
      'Draft-safe navigation for protected editing workflows',
    ],
  },
  {
    title: 'Delivery and quality',
    items: [
      'Vercel deployment for the Next.js application',
      'Vitest and Testing Library regression coverage',
      'TypeScript, ESLint, and production-build validation',
    ],
  },
] as const;

export default function ProjectIntelModal({ isOpen, onClose }: ProjectIntelModalProps) {
  return (
    <AppInfoDialog
      isOpen={isOpen}
      onClose={onClose}
      eyebrow="About this app"
      title="Camping Dashboard"
      description="A shared trip workspace for planning, field readiness, and on-trip reference."
      footer={<span>Built for clear decisions before and during a backcountry trip.</span>}
    >
      <div className="app-info-dialog__about">
        {ABOUT_SECTIONS.map((section) => (
          <section key={section.title} className="app-info-dialog__section">
            <h3>{section.title}</h3>
            <ul>
              {section.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </AppInfoDialog>
  );
}

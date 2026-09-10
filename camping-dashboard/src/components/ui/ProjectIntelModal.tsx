'use client';

import React from 'react';
import AppInfoDialog from './AppInfoDialog';

interface ProjectIntelModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const ABOUT_SECTIONS = [
  { title: 'Plan together', items: ['Keep your schedule, meals, gear and crew responsibilities in one trip workspace.'] },
  { title: 'Stay oriented', items: ['Review readiness, campsite context and field references before and during your trip.'] },
] as const;

export default function ProjectIntelModal({ isOpen, onClose }: ProjectIntelModalProps) {
  return (
    <AppInfoDialog
      isOpen={isOpen}
      onClose={onClose}
      eyebrow="Your trip workspace"
      title="About Field Protocol"
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

'use client';

import { useState } from 'react';
import { Check, Compass, Loader2, Sparkles } from 'lucide-react';
import type { ThemeVariant } from '@/types';
import AppInfoDialog from '@/components/ui/AppInfoDialog';

const OPTIONS: Array<{
  value: ThemeVariant;
  label: string;
  badge: string;
  description: string;
  icon: typeof Compass;
}> = [
  {
    value: 'expedition',
    label: 'Expedition',
    badge: 'Default',
    description: 'Immersive wilderness styling with the strongest sense of place.',
    icon: Compass,
  },
  {
    value: 'clean',
    label: 'Clean',
    badge: 'Secondary',
    description: 'A brighter, quieter presentation with frosted glass surfaces.',
    icon: Sparkles,
  },
];

export default function TripAppearanceDialog({
  isOpen,
  currentTheme,
  onSelect,
  onClose,
}: {
  isOpen: boolean;
  currentTheme: ThemeVariant;
  onSelect: (theme: ThemeVariant) => Promise<void>;
  onClose: () => void;
}) {
  const [isSaving, setIsSaving] = useState(false);
  const [pendingTheme, setPendingTheme] = useState<ThemeVariant | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSelect(theme: ThemeVariant) {
    if (theme === currentTheme || isSaving) return;
    setIsSaving(true);
    setPendingTheme(theme);
    setError(null);
    try {
      await onSelect(theme);
      onClose();
    } catch (selectionError) {
      setError(
        selectionError instanceof Error
          ? selectionError.message
          : 'The trip appearance could not be updated.'
      );
    } finally {
      setIsSaving(false);
      setPendingTheme(null);
    }
  }

  return (
    <AppInfoDialog
      isOpen={isOpen}
      onClose={onClose}
      eyebrow="Shared trip setting"
      title="Appearance"
      description="Choose the visual theme every member sees for this trip."
      footer={
        <p className="text-xs text-text-muted">
          Owners and editors can change this shared setting.
        </p>
      }
    >
      <fieldset disabled={isSaving} className="space-y-3">
        <legend className="sr-only">Trip theme</legend>
        {OPTIONS.map(({ value, label, badge, description, icon: Icon }) => {
          const selected = currentTheme === value;
          return (
            <label
              key={value}
              className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition-colors ${
                selected
                  ? 'border-accent-yellow bg-accent-yellow/10'
                  : 'border-border-subtle bg-card-bg hover:bg-card-hover'
              } ${isSaving ? 'cursor-wait opacity-70' : ''}`}
            >
              <input
                type="radio"
                name="trip-theme"
                value={value}
                checked={selected}
                onChange={() => void handleSelect(value)}
                className="sr-only"
              />
              <span
                className={`mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                  selected
                    ? 'bg-accent-yellow text-white'
                    : 'bg-card-hover text-text-muted'
                }`}
                aria-hidden="true"
              >
                {pendingTheme === value ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : selected ? (
                  <Check size={18} />
                ) : (
                  <Icon size={18} />
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-text-main">{label}</span>
                  <span className="rounded-full border border-border-subtle px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                    {badge}
                  </span>
                </span>
                <span className="mt-1 block text-sm leading-relaxed text-text-muted">
                  {description}
                </span>
              </span>
            </label>
          );
        })}
      </fieldset>

      {error ? (
        <p
          role="alert"
          className="mt-4 rounded-lg border border-accent-red/30 bg-accent-red/10 p-3 text-sm text-accent-red"
        >
          {error}
        </p>
      ) : null}
    </AppInfoDialog>
  );
}

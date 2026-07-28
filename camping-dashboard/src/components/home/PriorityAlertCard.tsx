import GuardedTripLink from '@/components/trip/GuardedTripLink';
import type { Alert } from '@/types';
import { Card } from '@/components/ui/Primitives';
import { AlertTriangle, CheckCircle2, ChevronRight, Info } from 'lucide-react';

function alertTone(severity: Alert['severity']) {
  if (severity === 'critical') {
    return {
      icon: AlertTriangle,
      className: 'border-accent-red/30 bg-accent-red/5',
    };
  }
  if (severity === 'info' || severity === 'advisory') {
    return {
      icon: Info,
      className: 'border-accent-blue/30 bg-accent-blue/5',
    };
  }
  return {
    icon: AlertTriangle,
    className: 'border-accent-yellow/30 bg-accent-yellow/5',
  };
}

function updatedLabel(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString('en-CA', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default function PriorityAlertCard({
  alert,
  href,
}: {
  alert: Alert | null;
  href: string;
}) {
  if (!alert) {
    return (
      <Card title="Priority notice" icon={CheckCircle2} className="h-full">
        <div className="flex flex-1 items-center gap-3 rounded-xl border border-accent-green/20 bg-accent-green/5 p-4">
          <CheckCircle2 className="shrink-0 text-accent-green" size={22} />
          <div>
            <h3 className="text-sm font-semibold text-text-main">No active notices</h3>
            <p className="mt-1 text-xs text-text-muted">
              No current advisories require attention.
            </p>
          </div>
        </div>
      </Card>
    );
  }

  const tone = alertTone(alert.severity);
  const Icon = tone.icon;
  const updated = updatedLabel(alert.updated_at);

  return (
    <Card
      title="Priority notice"
      icon={AlertTriangle}
      className="h-full"
      action={
        <GuardedTripLink
          href={href}
          className="inline-flex items-center gap-1 rounded text-xs font-medium text-accent-yellow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
          aria-label="View all field guide notices"
        >
          Field Guide <ChevronRight size={14} aria-hidden="true" />
        </GuardedTripLink>
      }
    >
      <div
        className={`flex flex-1 flex-col rounded-xl border p-4 ${tone.className}`}
        role="status"
        aria-label={`${alert.severity} priority notice`}
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <span className="inline-flex items-center gap-2 text-sm font-semibold capitalize text-text-main">
            <Icon size={20} className="shrink-0" aria-hidden="true" />
            {alert.severity}
          </span>
          {updated ? (
            <span className="text-[11px] text-text-muted">Updated {updated}</span>
          ) : null}
        </div>
        <h3 className="text-base font-bold text-text-main">{alert.title}</h3>
        <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-text-muted">
          {alert.body}
        </p>
      </div>
    </Card>
  );
}

import type { CrewMember } from '@/types';

export function splitResponsibilities(loadItem: string) {
  return loadItem.split(/\s*\+\s*/).map(item => item.trim()).filter(Boolean);
}

export function formatResponsibility(value: string) {
  if (value !== value.toUpperCase()) return value;
  return value.toLowerCase().replace(/\b\w/g, letter => letter.toUpperCase());
}

// Recorded member loads, not inferred gear weights. Preserve the roster's ratios.
export function getCrewLoadRows(crew: CrewMember[]) {
  const totalLoad = crew.reduce((total, member) => total + (member.load_weight_kg || 0), 0);
  return {
    totalLoad,
    rows: crew.map(member => {
      const weight = member.load_weight_kg || 0;
      const rawPercentage = totalLoad > 0 ? (weight / totalLoad) * 100 : 0;
      return { member, weight, rawPercentage, displayPercentage: Math.round(rawPercentage) };
    }),
  };
}

export function getCrewLoadBalance({ totalLoad, rows }: ReturnType<typeof getCrewLoadRows>) {
  const equalShare = rows.length > 0 ? 100 / rows.length : 0;
  const maxDeviationPercent = totalLoad > 0
    ? Math.max(...rows.map(({ rawPercentage }) => Math.abs(rawPercentage - equalShare)))
    : 0;
  if (totalLoad === 0) return { label: 'No Load Data', tone: 'unknown' } as const;
  if (maxDeviationPercent >= 20) return { label: 'Major Imbalance', tone: 'critical' } as const;
  if (maxDeviationPercent >= 10) return { label: 'Slight Imbalance', tone: 'warning' } as const;
  return { label: 'Optimal Balance', tone: 'ready' } as const;
}

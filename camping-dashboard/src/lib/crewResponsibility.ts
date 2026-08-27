import type { CrewMember, GearItem, Meal } from '@/types';

export interface CrewSelectOption {
  id: string;
  label: string;
}

export interface ResolvedCrewResponsibility {
  kind: 'resolved' | 'legacy' | 'unassigned';
  label: string;
  member: CrewMember | null;
}

function normalizedName(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLocaleLowerCase();
}

function memberDescriptor(member: CrewMember, fallbackIndex: number): string {
  const details = [
    member.role.trim() || null,
    member.canoe_number > 0 ? `Canoe ${member.canoe_number}` : null,
  ].filter((detail): detail is string => detail !== null);

  return details.join(' · ') || `Crew ${fallbackIndex + 1}`;
}

export function getCrewSelectOptions(crew: CrewMember[]): CrewSelectOption[] {
  const nameCounts = new Map<string, number>();
  crew.forEach((member) => {
    const key = normalizedName(member.name);
    nameCounts.set(key, (nameCounts.get(key) ?? 0) + 1);
  });

  return crew.map((member, index) => {
    const duplicate = (nameCounts.get(normalizedName(member.name)) ?? 0) > 1;
    return {
      id: member.id,
      label: duplicate
        ? `${member.name} — ${memberDescriptor(member, index)}`
        : member.name,
    };
  });
}

export function resolveCrewResponsibility(
  crewMemberId: string | null,
  legacyName: string | null,
  crew: CrewMember[]
): ResolvedCrewResponsibility {
  const member = crewMemberId
    ? crew.find((candidate) => candidate.id === crewMemberId) ?? null
    : null;

  if (member) {
    return { kind: 'resolved', label: member.name, member };
  }

  const legacyLabel = legacyName?.trim();
  if (legacyLabel) {
    return {
      kind: 'legacy',
      label: `Legacy assignment · ${legacyLabel}`,
      member: null,
    };
  }

  return { kind: 'unassigned', label: 'Unassigned', member: null };
}

export function getCrewGear(memberId: string, gear: GearItem[]): GearItem[] {
  return gear.filter((item) => item.responsible_crew_member_id === memberId);
}

export function getCrewMeals(memberId: string, meals: Meal[]): Meal[] {
  return meals.filter((meal) => meal.prep_crew_member_id === memberId);
}

export function getUnassignedRequiredGear(gear: GearItem[]): GearItem[] {
  return gear.filter(
    (item) => item.priority === 'critical' && item.responsible_crew_member_id === null
  );
}

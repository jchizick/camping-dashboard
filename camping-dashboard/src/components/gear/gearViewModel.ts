import type { GearItem } from '@/types';
import type { ReadinessCategoryResult } from '@/lib/readiness';
import { groupBy } from '@/lib/helpers';

const CATEGORY_ORDER = [
    'Shelter',
    'Navigation',
    'Cooking',
    'Safety',
    'Clothing',
    'Lighting',
    'Camp',
    'Admin',
    'Extras',
];

interface RequiredGearBrief {
    tone: 'coverage' | 'blocker' | 'warning' | 'ready';
    title: string;
    detail: string;
}

function itemCount(count: number, noun: string) {
    return `${count} ${noun}${count === 1 ? '' : 's'}`;
}

export function requiredGearBrief(category: ReadinessCategoryResult): RequiredGearBrief {
    if (category.availability !== 'scored') {
        return {
            tone: 'coverage',
            title: 'Required gear not identified',
            detail: 'Mark the gear you must have so Field Protocol can assess readiness.',
        };
    }

    const blockerCount = category.issues.filter((issue) => issue.severity === 'blocker').length;
    const warningCount = category.issues.filter((issue) => issue.severity === 'warning').length;

    if (blockerCount > 0) {
        return {
            tone: 'blocker',
            title: `${itemCount(blockerCount, 'required item')} missing`,
            detail: warningCount > 0
                ? `${itemCount(warningCount, 'acquired required item')} still ${warningCount === 1 ? 'needs' : 'need'} packing.`
                : 'Acquire or replace the missing gear before departure.',
        };
    }

    if (warningCount > 0) {
        return {
            tone: 'warning',
            title: `${itemCount(warningCount, 'required item')} still ${warningCount === 1 ? 'needs' : 'need'} packing`,
            detail: 'These items are on hand but are not physically packed yet.',
        };
    }

    return {
        tone: 'ready',
        title: 'Required gear ready',
        detail: 'Every identified Required item is packed.',
    };
}

export function getGearCategories(gear: readonly GearItem[]) {
    const normalized = gear.map(item => {
        const raw = item.category || 'Extras';
        return { ...item, category: raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase() };
    });
    return Object.entries(groupBy(normalized, item => item.category)).sort(([a], [b]) => {
        const ai = CATEGORY_ORDER.indexOf(a);
        const bi = CATEGORY_ORDER.indexOf(b);
        const aIdx = ai === -1 ? CATEGORY_ORDER.indexOf('Extras') - 0.5 : ai;
        const bIdx = bi === -1 ? CATEGORY_ORDER.indexOf('Extras') - 0.5 : bi;
        return aIdx - bIdx;
    });
}
'use client';

import React from 'react';
import type { ReadinessScore } from '@/types';
import GlassCard from '@/components/ui/GlassCard';
import SectionHeader from '@/components/ui/SectionHeader';
import ProgressBar from '@/components/ui/ProgressBar';

interface ReadinessScoreCardProps {
    readiness: ReadinessScore;
}

const subScores = [
    { key: 'gear' as const, label: 'Gear', icon: '🎒', weight: '35%' },
    { key: 'offline' as const, label: 'Offline Safety', icon: '📡', weight: '20%' },
    { key: 'meals' as const, label: 'Meals', icon: '🍲', weight: '20%' },
    { key: 'weather' as const, label: 'Weather Prep', icon: '🌤', weight: '15%' },
    { key: 'timeline' as const, label: 'Timeline', icon: '📋', weight: '10%' },
];

function scoreVariant(score: number): 'success' | 'default' | 'danger' {
    if (score >= 80) return 'success';
    if (score >= 50) return 'default';
    return 'danger';
}

function overallClass(score: number): string {
    if (score >= 90) return 'readiness-card__ring--locked';
    if (score >= 75) return 'readiness-card__ring--ready';
    if (score >= 50) return 'readiness-card__ring--attention';
    return 'readiness-card__ring--not-ready';
}

export default function ReadinessScoreCard({ readiness }: ReadinessScoreCardProps) {
    return (
        <GlassCard className="readiness-card">
            <SectionHeader title="Mission Readiness" icon="🎯" />

            <div className="readiness-card__hero">
                <div className={`readiness-card__ring ${overallClass(readiness.overall)}`}>
                    <span className="readiness-card__score">{readiness.overall}</span>
                    <span className="readiness-card__score-pct">%</span>
                </div>
                <div className="readiness-card__label-block">
                    <p className="readiness-card__label">{readiness.label}</p>
                    <p className="readiness-card__sublabel">Overall expedition readiness</p>
                </div>
            </div>

            <div className="readiness-card__breakdown">
                {subScores.map(({ key, label, icon, weight }) => (
                    <div key={key} className="readiness-card__sub">
                        <div className="readiness-card__sub-header">
                            <span className="readiness-card__sub-icon">{icon}</span>
                            <span className="readiness-card__sub-label">{label}</span>
                            <span className="readiness-card__sub-weight">{weight}</span>
                            <span className="readiness-card__sub-value">{readiness[key]}%</span>
                        </div>
                        <ProgressBar
                            value={readiness[key]}
                            showPercent={false}
                            variant={scoreVariant(readiness[key])}
                            size="sm"
                        />
                    </div>
                ))}
            </div>
        </GlassCard>
    );
}

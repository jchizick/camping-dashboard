'use client';

import React, { useEffect, useState, useRef } from 'react';
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
    const [isVisible, setIsVisible] = useState(false);
    const ringRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting) {
                    setIsVisible(true);
                    observer.disconnect();
                }
            },
            { threshold: 0.1 }
        );

        if (ringRef.current) {
            observer.observe(ringRef.current);
        }

        return () => observer.disconnect();
    }, []);

    const size = 90;
    const strokeWidth = 2;
    const radius = Math.floor((size - strokeWidth) / 2);
    const circumference = Math.round(radius * 2 * Math.PI);
    const dashOffset = isVisible ? circumference - (readiness.overall / 100) * circumference : circumference;

    return (
        <GlassCard className="readiness-card">
            <SectionHeader title="Mission Readiness" icon="🎯" />

            <div className="readiness-card__hero">
                <div ref={ringRef} className={`readiness-card__ring ${overallClass(readiness.overall)}`}>
                    <svg className="readiness-card__svg" width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
                        <circle
                            className="readiness-card__track"
                            cx={size / 2} cy={size / 2} r={radius}
                            fill="transparent" strokeWidth={strokeWidth}
                        />
                        <circle
                            className="readiness-card__progress"
                            cx={size / 2} cy={size / 2} r={radius}
                            fill="transparent" stroke="currentColor"
                            strokeWidth={strokeWidth}
                            strokeDasharray={circumference}
                            strokeDashoffset={dashOffset}
                            strokeLinecap="round"
                        />
                    </svg>
                    <div className="readiness-card__content">
                        <span className="readiness-card__score">{readiness.overall}</span>
                        <span className="readiness-card__score-pct">%</span>
                    </div>
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

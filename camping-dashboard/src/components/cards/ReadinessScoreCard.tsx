'use client';

import React, { useEffect, useState, useRef } from 'react';
import type { ReadinessScore } from '@/types';
import { Card, ProgressBar } from '@/components/ui/Primitives';
import { Activity, Tent, ShieldAlert, Utensils, CloudRain, Clock } from 'lucide-react';

interface ReadinessScoreCardProps {
    readiness: ReadinessScore;
}

const subScores = [
    { key: 'gear' as const, label: 'Gear', icon: Tent, bgHover: 'bg-accent-red' },
    { key: 'offline' as const, label: 'Offline Safety', icon: ShieldAlert, bgHover: 'bg-accent-red' },
    { key: 'meals' as const, label: 'Meals', icon: Utensils, bgHover: 'bg-accent-yellow' },
    { key: 'weather' as const, label: 'Weather Prep', icon: CloudRain, bgHover: 'bg-accent-green' },
    { key: 'timeline' as const, label: 'Timeline', icon: Clock, bgHover: 'bg-accent-blue' },
];

function scoreColor(score: number): string {
    if (score >= 80) return 'bg-accent-green';
    if (score >= 50) return 'bg-accent-yellow';
    return 'bg-accent-red';
}

function strokeColor(score: number): string {
    if (score >= 80) return 'var(--color-accent-green)';
    if (score >= 50) return 'var(--color-accent-yellow)';
    return 'var(--color-accent-red)';
}

function textColor(score: number): string {
    if (score >= 80) return 'text-accent-green';
    if (score >= 50) return 'text-accent-yellow';
    return 'text-accent-red';
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

        if (ringRef.current) observer.observe(ringRef.current);
        return () => observer.disconnect();
    }, []);

    const size = 96;
    const strokeWidth = 8;
    const radius = 42;
    const circumference = Math.round(radius * 2 * Math.PI);
    const dashOffset = isVisible ? circumference - (readiness.overall / 100) * circumference : circumference;

    const mainColorClass = textColor(readiness.overall);
    const mainStrokeValue = strokeColor(readiness.overall);

    return (
        <Card title="Mission Readiness" icon={Activity} className="h-full">
            <div className="flex items-center gap-6 mb-8">
                <div ref={ringRef} className="relative w-24 h-24 flex items-center justify-center">
                    <svg className="absolute inset-0 w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                        <circle cx="50" cy="50" r={radius} fill="none" stroke="var(--color-border-subtle)" strokeWidth={strokeWidth} />
                        <circle 
                            cx="50" cy="50" r={radius} fill="none" 
                            stroke={mainStrokeValue} 
                            strokeWidth={strokeWidth} 
                            strokeDasharray={circumference} 
                            strokeDashoffset={dashOffset} 
                            strokeLinecap="round"
                            className="transition-all duration-1000 ease-out delay-300" 
                        />
                    </svg>
                    <div className="text-center z-10 flex items-baseline">
                        <span className={`text-3xl font-bold font-mono ${mainColorClass}`}>{readiness.overall}</span>
                        <span className={`text-sm font-mono ${mainColorClass}`}>%</span>
                    </div>
                </div>
                <div>
                    <div className="text-lg font-medium text-text-main mb-1">{readiness.label}</div>
                    <div className="text-sm text-text-muted">Overall expedition readiness</div>
                </div>
            </div>

            <div className="space-y-4">
                {subScores.map(({ key, label, icon: Icon }) => (
                    <div key={key}>
                        <div className="flex justify-between text-xs font-mono text-text-muted mb-2">
                            <span className="flex items-center gap-2">
                                <Icon size={14} />
                                {label}
                            </span>
                            <span className={textColor(readiness[key])}>{readiness[key]}%</span>
                        </div>
                        <ProgressBar value={readiness[key]} colorClass={scoreColor(readiness[key])} />
                    </div>
                ))}
            </div>
        </Card>
    );
}

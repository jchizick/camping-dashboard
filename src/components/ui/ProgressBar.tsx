'use client';

import React from 'react';

interface ProgressBarProps {
    value: number; // 0–100
    label?: string;
    showPercent?: boolean;
    variant?: 'default' | 'accent' | 'danger' | 'success';
    size?: 'sm' | 'md' | 'lg';
    animated?: boolean;
}

export default function ProgressBar({
    value,
    label,
    showPercent = true,
    variant = 'default',
    size = 'md',
    animated = true,
}: ProgressBarProps) {
    const clamped = Math.min(Math.max(value, 0), 100);

    return (
        <div className={`progress-bar-wrapper progress-bar--${size}`}>
            {(label || showPercent) && (
                <div className="progress-bar__header">
                    {label && <span className="progress-bar__label">{label}</span>}
                    {showPercent && <span className="progress-bar__percent">{clamped}%</span>}
                </div>
            )}
            <div className="progress-bar__track">
                <div
                    className={`progress-bar__fill progress-bar__fill--${variant} ${animated ? 'progress-bar__fill--animated' : ''}`}
                    style={{ width: `${clamped}%` }}
                    role="progressbar"
                    aria-valuenow={clamped}
                    aria-valuemin={0}
                    aria-valuemax={100}
                />
            </div>
        </div>
    );
}

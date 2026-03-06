'use client';

import React from 'react';
import type { AlertSeverity } from '@/types';

type PillVariant = AlertSeverity | 'ok' | 'packed' | 'missing' | 'critical';

interface StatusPillProps {
    label: string;
    variant?: PillVariant;
    size?: 'sm' | 'md';
}

export default function StatusPill({ label, variant = 'ok', size = 'md' }: StatusPillProps) {
    return (
        <span className={`status-pill status-pill--${variant} status-pill--${size}`}>
            {label}
        </span>
    );
}

'use client';

import React from 'react';

interface MetricRowProps {
    label: string;
    value: string | number;
    unit?: string;
    icon?: string;
    highlight?: boolean;
}

export default function MetricRow({ label, value, unit, icon, highlight = false }: MetricRowProps) {
    return (
        <div className={`metric-row ${highlight ? 'metric-row--highlight' : ''}`}>
            <span className="metric-row__label">
                {icon && <span className="metric-row__icon">{icon}</span>}
                {label}
            </span>
            <span className="metric-row__value">
                {value}
                {unit && <span className="metric-row__unit">{unit}</span>}
            </span>
        </div>
    );
}

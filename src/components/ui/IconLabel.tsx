'use client';

import React from 'react';

interface IconLabelProps {
    icon: string;
    label: string;
    sublabel?: string;
    className?: string;
}

export default function IconLabel({ icon, label, sublabel, className = '' }: IconLabelProps) {
    return (
        <div className={`icon-label ${className}`}>
            <span className="icon-label__icon">{icon}</span>
            <div className="icon-label__text">
                <span className="icon-label__label">{label}</span>
                {sublabel && <span className="icon-label__sublabel">{sublabel}</span>}
            </div>
        </div>
    );
}

'use client';

import React from 'react';

interface SectionHeaderProps {
    title: string;
    icon?: string;
    subtitle?: string;
    className?: string;
}

export default function SectionHeader({ title, icon, subtitle, className = '' }: SectionHeaderProps) {
    return (
        <div className={`section-header ${className}`}>
            <div className="section-header__top">
                {icon && <span className="section-header__icon">{icon}</span>}
                <h2 className="section-header__title">{title}</h2>
            </div>
            {subtitle && <p className="section-header__subtitle">{subtitle}</p>}
            <div className="section-header__divider" />
        </div>
    );
}

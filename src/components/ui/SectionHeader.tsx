'use client';

import React from 'react';

interface SectionHeaderProps {
    title: string;
    icon?: string;
    subtitle?: string;
    className?: string;
    onAdd?: () => void;
    addLabel?: string;
}

export default function SectionHeader({ title, icon, subtitle, className = '', onAdd, addLabel = 'Add item' }: SectionHeaderProps) {
    return (
        <div className={`section-header ${className}`}>
            <div className="section-header__top">
                {icon && <span className="section-header__icon">{icon}</span>}
                <h2 className="section-header__title">{title}</h2>
                {onAdd && (
                    <button
                        className="card-add-btn"
                        onClick={onAdd}
                        aria-label={addLabel}
                        title={addLabel}
                    >
                        +
                    </button>
                )}
            </div>
            {subtitle && <p className="section-header__subtitle">{subtitle}</p>}
            <div className="section-header__divider" />
        </div>
    );
}

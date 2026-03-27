'use client';

import React from 'react';

interface GlassCardProps {
    children: React.ReactNode;
    className?: string;
    onClick?: () => void;
    role?: string;
    'aria-label'?: string;
}

export default function GlassCard({ children, className = '', onClick, role, 'aria-label': ariaLabel }: GlassCardProps) {
    return (
        <div
            className={`glass-card ${className}`}
            onClick={onClick}
            role={role}
            aria-label={ariaLabel}
        >
            {children}
        </div>
    );
}

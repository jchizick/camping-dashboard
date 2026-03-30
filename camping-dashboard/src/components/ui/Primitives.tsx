import React from 'react';

export const Card = ({ children, className = '', title, icon: Icon, action }: any) => (
  <div className={`bg-card-bg border border-border-subtle rounded-2xl overflow-hidden flex flex-col ${className}`}>
    {(title || Icon) && (
      <div className="px-5 py-4 border-b border-border-subtle flex items-center justify-between bg-card-bg/50 shrink-0">
        <div className="flex items-center gap-2 text-text-muted uppercase tracking-wider text-xs font-semibold">
          {Icon && <Icon size={16} className="text-accent-yellow" />}
          {title}
        </div>
        {action && <div>{action}</div>}
      </div>
    )}
    <div className="p-5 flex-1 flex flex-col min-h-0">{children}</div>
  </div>
);

export const ProgressBar = ({ value, colorClass = 'bg-accent-yellow', bgClass = 'bg-border-subtle', height = 'h-1.5', className = '' }: any) => (
  <div className={`w-full ${bgClass} rounded-full overflow-hidden ${height} ${className}`}>
    <div className={`${colorClass} h-full rounded-full transition-all duration-500`} style={{ width: `${value}%` }} />
  </div>
);

export const Badge = ({ children, variant = 'default' }: any) => {
  const variants: any = {
    default: 'bg-border-subtle text-text-muted',
    warning: 'bg-accent-yellow/10 text-accent-yellow border border-accent-yellow/20',
    info: 'bg-accent-blue/10 text-accent-blue border border-accent-blue/20',
    success: 'bg-accent-green/10 text-accent-green border border-accent-green/20',
  };
  return (
    <span className={`px-2 py-0.5 rounded text-[10px] uppercase tracking-wider font-mono ${variants[variant]}`}>
      {children}
    </span>
  );
};

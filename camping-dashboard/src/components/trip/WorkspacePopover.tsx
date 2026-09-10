'use client';

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { useOverlayDialog } from '@/components/ui/useOverlayDialog';
import './workspaceAccount.css';

/** A small dialog, with normal Tab navigation and the shared focus/scroll lock. */
export default function WorkspacePopover({ anchor, title, onClose, children }: {
  anchor: RefObject<HTMLButtonElement | null>; title: string; onClose: () => void; children: ReactNode;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ left: 16, top: 16 });
  useOverlayDialog(true, panel);
  useLayoutEffect(() => {
    function place() {
      const rect = anchor.current?.getBoundingClientRect();
      const height = panel.current?.getBoundingClientRect().height ?? 0;
      const width = panel.current?.getBoundingClientRect().width ?? 288;
      setPosition({ left: Math.max(16, Math.min((rect?.right ?? 16) + 8, innerWidth - width - 16)),
        top: Math.max(16, Math.min(rect?.top ?? 16, innerHeight - height - 16)) });
    }
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => { window.removeEventListener('resize', place); window.removeEventListener('scroll', place, true); };
  }, [anchor]);
  useEffect(() => {
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') { event.preventDefault(); onClose(); } };
    document.addEventListener('keydown', escape);
    return () => document.removeEventListener('keydown', escape);
  }, [onClose]);
  return createPortal(<div className="workspace-popover-overlay" onPointerDown={onClose}>
    <div ref={panel} role="dialog" aria-modal="true" aria-label={title} tabIndex={-1}
      className="workspace-popover" style={position} onPointerDown={(event) => event.stopPropagation()}>
      <div className="workspace-popover__header"><strong>{title}</strong><button type="button" aria-label={`Close ${title}`} onClick={onClose}>×</button></div>
      {children}
    </div>
  </div>, document.body);
}

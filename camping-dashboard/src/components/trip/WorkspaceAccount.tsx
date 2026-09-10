'use client';

import { useRef, useState } from 'react';
import { ChevronDown, UserRound } from 'lucide-react';
import { useAuth } from '@/lib/authContext';
import WorkspacePopover from './WorkspacePopover';

function useAccountLabel() {
  const { user, identity } = useAuth();
  const text = (value: unknown) => typeof value === 'string' ? value.trim() : '';
  const name = text(user?.user_metadata?.full_name) || text(user?.user_metadata?.name);
  const email = text(user?.email);
  return { name: name || email || (identity?.source === 'local' ? 'Saved account' : 'Account'),
    detail: email && email !== name ? email : '',
    fallback: !user ? (identity?.source === 'local' ? 'Profile unavailable offline' : 'Profile unavailable') : '' };
}

export function AccountIdentity() {
  const account = useAccountLabel();
  return <div className="workspace-account-identity"><strong>{account.name}</strong>
    {account.detail && account.detail !== account.name && <span>{account.detail}</span>}
    {account.fallback && <span>{account.fallback}</span>}
  </div>;
}

export function AccountActions({ onAbout, onSignOut }: { onAbout: () => void; onSignOut: () => void }) {
  return <div className="workspace-account-actions">
    <AccountIdentity />
    <button type="button" onClick={onAbout}>About Field Protocol</button>
    <button type="button" className="workspace-account-signout" onClick={onSignOut}>Sign out</button>
  </div>;
}

export default function WorkspaceAccount({ onAbout, onSignOut }: { onAbout: () => void; onSignOut: () => Promise<void> }) {
  const { user, identity } = useAuth();
  // Reset the open surface when the authenticated identity changes.
  return <AccountMenu key={user?.id ?? identity?.userId ?? 'unknown'} onAbout={onAbout} onSignOut={onSignOut} />;
}

function AccountMenu({ onAbout, onSignOut }: { onAbout: () => void; onSignOut: () => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const account = useAccountLabel();
  function run(action: () => void | Promise<void>) { setOpen(false); void action(); }
  return <div className="workspace-account">
    <button ref={trigger} type="button" className="workspace-account-trigger" aria-label={`Account: ${account.name}`}
      aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(true)}>
      <UserRound size={18} aria-hidden="true" /><span title={account.name}>{account.name}</span><ChevronDown size={14} aria-hidden="true" />
    </button>
    {open && <WorkspacePopover anchor={trigger} title="Account" onClose={() => setOpen(false)}>
      <AccountActions onAbout={() => run(onAbout)} onSignOut={() => run(onSignOut)} />
    </WorkspacePopover>}
  </div>;
}

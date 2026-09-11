import type { Metadata } from 'next';
import { AuthProvider } from '@/lib/authContext';
import InvitationLanding from '@/components/invitations/InvitationLanding';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title:'Trip invitation · Field Protocol', robots:{index:false,follow:false}, referrer:'no-referrer' };

// GET renders only a shell. No invitation mutation (or privileged lookup) occurs here.
export default function InvitationPage() {
  return <AuthProvider><InvitationLanding /></AuthProvider>;
}

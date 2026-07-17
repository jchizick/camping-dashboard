// ============================================================
// / — Root Route (Server Component)
// Redirects to the trip list. This is now a multi-trip app.
// ============================================================

import { redirect } from 'next/navigation';

export default function RootPage() {
  redirect('/trips');
}

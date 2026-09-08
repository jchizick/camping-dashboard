/** Exact canonical routes only: queries and unmigrated domains retain their contracts. */
export function desktopSectionHeading(pathname: string, tripId: string) {
  const base = `/trips/${encodeURIComponent(tripId)}`;
  if (pathname === base) return 'desktop-overview-title';
  if (pathname === `${base}/plan`) return 'desktop-plan-title';
  if (pathname === `${base}/gear`) return 'desktop-gear-title';
  if (pathname === `${base}/crew`) return 'desktop-crew-title';
  if (pathname === `${base}/guide`) return 'desktop-field-title';
  return null;
}

'use client';

import HomeOverview from '@/components/home/HomeOverview';
import DesktopWorkspacePlanSection from '@/components/plan/DesktopWorkspacePlanSection';
import DesktopWorkspaceGearSection from '@/components/gear/DesktopWorkspaceGearSection';

/** The persistent route-content slot for migrated desktop sections. */
export default function DesktopWorkspaceDocument({ pathname, tripId }: { pathname: string; tripId: string }) {
  return (
    <div data-desktop-workspace-document data-workspace-trip-id={tripId}>
      <HomeOverview />
      <DesktopWorkspacePlanSection navigationPath={pathname} />
      <DesktopWorkspaceGearSection navigationPath={pathname} />
    </div>
  );
}

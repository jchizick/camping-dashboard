'use client';

import FieldPrepFeedCard from '@/components/cards/FieldPrepFeedCard';
import TripPageHeader, { TripSectionPage } from '@/components/trip/TripPageHeader';
import { useTripWorkspace } from '@/components/trip/TripWorkspaceProvider';

export default function TripFieldLogPage() {
  const { data, prepFeed, editableActions, uploaderName } = useTripWorkspace();
  if (!data) return null;

  return (
    <TripSectionPage route="field-log">
      <TripPageHeader title="Field Log" description="Trip preparation feed" />
      <div className="trip-section-surface max-w-5xl">
        <FieldPrepFeedCard
          items={prepFeed}
          onAdd={editableActions?.addPrepFeedItem}
          onDelete={editableActions?.deletePrepFeedItem}
          defaultUploader={uploaderName}
        />
      </div>
    </TripSectionPage>
  );
}

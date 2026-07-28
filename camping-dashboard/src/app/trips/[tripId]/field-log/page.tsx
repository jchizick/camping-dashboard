'use client';

import FieldPrepFeedCard from '@/components/cards/FieldPrepFeedCard';
import TripPageHeader from '@/components/trip/TripPageHeader';
import { useTripWorkspace } from '@/components/trip/TripWorkspaceProvider';

export default function TripFieldLogPage() {
  const { data, prepFeed, editableActions, uploaderName } = useTripWorkspace();
  if (!data) return null;

  return (
    <div className="relative z-10 mx-auto max-w-[1600px] space-y-6 p-4 md:p-6 lg:p-8">
      <TripPageHeader title="Field Log" description="Trip preparation feed" />
      <div className="max-w-5xl">
        <FieldPrepFeedCard
          items={prepFeed}
          onAdd={editableActions?.addPrepFeedItem}
          onDelete={editableActions?.deletePrepFeedItem}
          defaultUploader={uploaderName}
        />
      </div>
    </div>
  );
}

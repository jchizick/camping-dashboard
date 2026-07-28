'use client';

import React, { useEffect, useRef } from 'react';
import AppInfoDialog from './AppInfoDialog';

const MISSION_BRIEF_URL =
  'https://jeelonevfpoifdci.public.blob.vercel-storage.com/mission-brief-v2.mp4';

interface MissionBriefModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function MissionBriefModal({ isOpen, onClose }: MissionBriefModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (!videoRef.current) return;

    if (isOpen) {
      videoRef.current.currentTime = 0;
      videoRef.current.play().catch(() => {
        // Browsers may require a user gesture; native controls remain available.
      });
    } else {
      videoRef.current.pause();
    }
  }, [isOpen]);

  return (
    <AppInfoDialog
      isOpen={isOpen}
      onClose={onClose}
      eyebrow="Trip orientation"
      title="Mission Brief"
      description="Algonquin · Maple Leaf Lake · Site 4"
      size="wide"
      footer={<span>Use the player controls to pause, seek, or enter fullscreen.</span>}
    >
      <div className="app-info-dialog__video-wrap">
        <video
          ref={videoRef}
          src={MISSION_BRIEF_URL}
          controls
          playsInline
          className="app-info-dialog__video"
        />
      </div>
    </AppInfoDialog>
  );
}

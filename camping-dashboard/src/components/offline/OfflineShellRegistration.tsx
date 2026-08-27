'use client';

import { useEffect } from 'react';
import {
  registerOfflineShell,
  removeFieldProtocolWorkerInDevelopment,
} from '@/lib/offlineShell';

export default function OfflineShellRegistration() {
  useEffect(() => {
    if (process.env.NODE_ENV === 'production') {
      void registerOfflineShell();
    } else {
      void removeFieldProtocolWorkerInDevelopment();
    }
  }, []);

  return null;
}

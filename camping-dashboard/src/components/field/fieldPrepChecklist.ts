import type { LucideIcon } from 'lucide-react';
import {
  AlertTriangle,
  Car,
  CheckCircle2,
  Map,
  Navigation,
  Radio,
} from 'lucide-react';
import type { OfflineStatus } from '@/types';

export interface FieldPrepCheck {
  key: Exclude<keyof OfflineStatus, 'trip_id' | 'updated_at' | 'satellite_device_name'>;
  label: string;
  icon: LucideIcon;
}

export const FIELD_PREP_CHECKS: readonly FieldPrepCheck[] = [
  { key: 'maps_cached', label: 'Maps Cached', icon: Map },
  { key: 'permit_saved', label: 'Permit Saved', icon: CheckCircle2 },
  { key: 'daily_vehicle_permit_saved', label: 'Daily Vehicle Permit', icon: Car },
  { key: 'route_downloaded', label: 'Route Downloaded', icon: Navigation },
  { key: 'satellite_device_connected', label: 'Satellite Device', icon: Radio },
  { key: 'emergency_contact_ready', label: 'Emergency Contact', icon: AlertTriangle },
];

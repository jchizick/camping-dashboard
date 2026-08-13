import Image from 'next/image';
import {
  Check,
  ChevronDown,
  Settings,
  Sun,
  TentTree,
  Users,
} from 'lucide-react';

import { ExpeditionRouteMap } from './ExpeditionRouteMap';

const gearItems = [
  { label: 'Tent', packed: true },
  { label: 'Sleeping Bag', packed: true },
  { label: 'Camp Stove', packed: true },
  { label: 'Headlamp', packed: true },
  { label: 'Water Filter', packed: false },
  { label: 'First Aid Kit', packed: false },
] as const;

function PackingStatusPreview() {
  return (
    <div className="signed-out-preview-card signed-out-packing">
      <span className="signed-out-card-label">Packing status</span>
      <div className="signed-out-packing__body">
        <div className="signed-out-readiness-ring"><strong>86%</strong></div>
        <div className="signed-out-packing__copy">
          <strong>Well prepared!</strong>
          <p>You&apos;re all set for great conditions.</p>
          <span>View checklist <b aria-hidden="true">→</b></span>
        </div>
      </div>
    </div>
  );
}

function WeatherPreview() {
  return (
    <div className="signed-out-preview-card signed-out-weather">
      <span className="signed-out-card-label">Weather</span>
      <div className="signed-out-weather__reading">
        <strong>18°</strong>
        <Sun size={43} strokeWidth={1.45} />
      </div>
      <p>Sunny</p>
      <small>Feels like 18°</small>
      <div className="signed-out-weather__range"><span>↑&nbsp; 20°</span><span>↓&nbsp; 9°</span></div>
    </div>
  );
}

function GearChecklistPreview() {
  return (
    <div className="signed-out-preview-card signed-out-gear">
      <span className="signed-out-card-label">Gear checklist</span>
      <ul>
        {gearItems.map((item) => (
          <li key={item.label}>
            <span className={item.packed ? 'signed-out-gear__check signed-out-gear__check--done' : 'signed-out-gear__check'}>
              {item.packed ? <Check size={12} strokeWidth={2.4} /> : null}
            </span>
            {item.label}
          </li>
        ))}
      </ul>
      <div className="signed-out-card-action">View full checklist <span aria-hidden="true">→</span></div>
    </div>
  );
}

function PreviewControlBar() {
  return (
    <div className="signed-out-preview-controls">
      <div className="signed-out-preview-selector">
        <TentTree size={18} />
        <span>Algonquin Canoe Trip</span>
        <ChevronDown size={16} />
      </div>
      <div className="signed-out-preview-control"><Users size={18} /><span>4</span></div>
      <div className="signed-out-preview-control signed-out-preview-control--icon"><Settings size={18} /></div>
    </div>
  );
}

export function SignedOutProductPreview() {
  return (
    <div className="signed-out-preview" aria-hidden="true">
      <ExpeditionRouteMap />
      <div className="signed-out-scenic">
        <Image
          src="/trips/signed-out-sunset-canoe-composed.webp"
          alt=""
          fill
          priority
          quality={92}
          sizes="(min-width: 1200px) 66vw, (min-width: 768px) 72vw, 850px"
          className="signed-out-scenic__image"
        />
        <div className="signed-out-scenic__edge" />
        <PreviewControlBar />
        <PackingStatusPreview />
        <WeatherPreview />
        <GearChecklistPreview />
      </div>
    </div>
  );
}

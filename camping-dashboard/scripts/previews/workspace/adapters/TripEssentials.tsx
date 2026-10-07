import { Backpack, Utensils, Users } from 'lucide-react';

export function TripEssentials() {
  return (
    <section className="workspace-preview__essentials" aria-label="Example trip essentials">
      <h2>Trip essentials</h2>
      <dl>
        <div>
          <dt><Backpack size={16} strokeWidth={1.6} aria-hidden="true" />Gear</dt>
          <dd>Critical gear packed.</dd>
        </div>
        <div>
          <dt><Utensils size={16} strokeWidth={1.6} aria-hidden="true" />Meals</dt>
          <dd>Meals planned for each day.</dd>
        </div>
        <div>
          <dt><Users size={16} strokeWidth={1.6} aria-hidden="true" />Crew</dt>
          <dd>Gear and meal prep assigned.</dd>
        </div>
      </dl>
    </section>
  );
}

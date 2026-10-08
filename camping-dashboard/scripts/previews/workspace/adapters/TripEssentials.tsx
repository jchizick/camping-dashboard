import { Backpack, ChevronRight, Utensils, Users } from 'lucide-react';
import { moduleCoverage } from '../coverage';

const icons = { gear: Backpack, meals: Utensils, crew: Users };

export function TripEssentials() {
  return (
    <section className="workspace-preview__essentials" aria-label="Example trip essentials">
      <header className="workspace-preview__coverage-heading">
        <h2>Trip essentials</h2>
        <span>COVERAGE COUNTERS</span>
      </header>
      <div className="workspace-preview__coverage-grid">
        {moduleCoverage.map(module => {
          const Icon = icons[module.id];
          return (
            <div className="workspace-preview__coverage-module" data-coverage-module={module.id} key={module.id}>
              <Icon className="workspace-preview__coverage-icon" size={32} strokeWidth={1.6} aria-hidden="true" />
              <div className="workspace-preview__coverage-body">
                <div className="workspace-preview__coverage-copy">
                  <h3>{module.label}</h3>
                  <p>{module.descriptor}</p>
                </div>
                <div className="workspace-preview__coverage-fraction" aria-label={module.count + ' of ' + module.total + ' ' + module.unit}>
                  <span>{module.count}<small>{module.unit}</small></span>
                  <span className="workspace-preview__coverage-slash" aria-hidden="true">/</span>
                  <span>{module.total}<small>total</small></span>
                </div>
                <div className="workspace-preview__coverage-meter" role="meter" aria-label={module.label + ' coverage'}
                  aria-valuemin={0} aria-valuemax={module.total} aria-valuenow={module.count}>
                  <span style={{ width: (module.count / module.total * 100) + '%' }} />
                </div>
              </div>
              <ChevronRight className="workspace-preview__coverage-chevron" size={16} strokeWidth={1.6} aria-hidden="true" />
            </div>
          );
        })}
      </div>
    </section>
  );
}

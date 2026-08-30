import React from 'react';

export default function AuthenticatedTripsLoader() {
  return (
    <main
      className="authenticated-trips-loader"
      data-authenticated-trips-loader
      aria-busy="true"
    >
      <div
        className="authenticated-trips-loader__content"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        <svg
          className="authenticated-trips-loader__logo"
          viewBox="0 0 212 212"
          aria-hidden="true"
          focusable="false"
        >
          <use
            className="authenticated-trips-loader__shield"
            href="/logo.svg#waypoint-shield"
          />
          <use
            className="authenticated-trips-loader__route"
            href="/logo.svg#waypoint-route"
          />
          <use
            className="authenticated-trips-loader__waypoint"
            href="/logo.svg#waypoint-pin"
          />
          <use
            className="authenticated-trips-loader__waypoint-glow"
            href="/logo.svg#waypoint-pin"
          />
        </svg>
        <p>PREPARING BASE CAMP…</p>
      </div>
    </main>
  );
}

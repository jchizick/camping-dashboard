import React from 'react';

const WAYPOINT_ROUTE_PATH =
  'M121.6,185.5c-3.2-8.9-0.1-17.4-0.2-26c0-1.8,0-3.5-0.4-5.2c-1.1-4.8-5.1-8.4-9.5-10.5c-4.4-2.1-9.3-2.8-14.1-3.8c-6.7-1.4-13.4-3.2-19.9-5.4c-3.7-1.3-7.7-2.9-9.9-6.2c-2.4-3.6-2.3-8.5-0.3-12.3c2-3.8,5.7-6.6,9.6-8.3c4-1.7,8.4-2.5,12.7-3.1c7.8-1.1,15.7-1.8,23.6-2.6c3.3-0.3,6.7-0.6,10-0.9c3.6-0.3,7.3-0.7,10.4-2.3c3.2-1.7,5.8-4.9,5.5-8.5';

const WAYPOINT_SHIELD_PATH =
  'M105.3,4c-0.3,0.1-0.7,0.2-1,0.3L29.7,31.7c-2,0.7-3.3,2.6-3.3,4.7v82.1c0,19.4,11,35.6,25.7,49.7c14.8,14.1,33.6,26.6,51,38.9c1.7,1.2,4,1.2,5.8,0c17.4-12.4,36.2-24.8,51-38.9c14.8-14.1,25.7-30.2,25.7-49.7V36.3c0-2.1-1.3-3.9-3.3-4.7L107.7,4.3C106.9,4,106.1,3.9,105.3,4z M106,14.3l66.1,24.3c2.1,0.8,3.5,2.8,3.5,5v74.8c0,15.7-8.8,29.3-22.6,42.5c-13.1,12.5-30.3,24.1-47,35.9c-16.7-11.8-34-23.4-47-35.9c-13.8-13.2-22.6-26.8-22.6-42.5V43.6c0-2.3,1.4-4.3,3.5-5L106,14.3z';

const WAYPOINT_PIN_PATH =
  'M153.9,49.2c-3.9-7.8-13.5-11-21.3-7s-10.8,13.8-7,21.3c1.8,3.5,9.3,12.8,12.6,16.8c0.8,1,2.3,1,3.2,0c3.3-4.1,10.7-13.3,12.6-16.8C156.4,59,156.3,53.8,153.9,49.2z M139.8,64.6c-4.6,0-8.2-3.7-8.2-8.2c0-4.6,3.7-8.2,8.2-8.2s8.2,3.7,8.2,8.2C148.1,60.9,144.4,64.6,139.8,64.6z';

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
          <path
            className="authenticated-trips-loader__shield"
            data-logo-part="shield"
            d={WAYPOINT_SHIELD_PATH}
            fill="#739774"
          />
          <path
            className="authenticated-trips-loader__route"
            data-logo-part="route"
            d={WAYPOINT_ROUTE_PATH}
            fill="none"
            pathLength="1"
            stroke="#E4A83D"
            strokeLinecap="round"
            strokeMiterlimit="10"
            strokeWidth="8"
          />
          <path
            className="authenticated-trips-loader__waypoint"
            data-logo-part="waypoint"
            d={WAYPOINT_PIN_PATH}
            fill="#E4A83D"
          />
          <path
            className="authenticated-trips-loader__waypoint-glow"
            data-logo-part="waypoint-glow"
            d={WAYPOINT_PIN_PATH}
            fill="#E4A83D"
          />
        </svg>
        <p>PREPARING BASE CAMP…</p>
      </div>
    </main>
  );
}

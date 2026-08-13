const routeStops = [
  { x: 76, y: 630, title: 'Access Point', subtitle: 'Lake of Two Rivers', kind: 'access' },
  { x: 322, y: 542, title: 'Taylor Lake', subtitle: 'Campsite', kind: 'camp' },
  { x: 184, y: 351, title: 'Little John Lake', subtitle: 'Campsite', kind: 'camp' },
  { x: 338, y: 168, title: 'Smoke Lake', subtitle: 'Campsite', kind: 'camp' },
] as const;

function RouteMarker({ stop }: { stop: (typeof routeStops)[number] }) {
  return (
    <g transform={`translate(${stop.x} ${stop.y})`}>
      <circle r="22" fill="#102b20" stroke="#d5a94d" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
      {stop.kind === 'camp' ? (
        <g fill="none" stroke="#f0bc50" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" vectorEffect="non-scaling-stroke">
          <path d="M-9 8 0-9 9 8Z" />
          <path d="M0-9 3 8M-5 2h10" />
        </g>
      ) : (
        <g fill="none" stroke="#f0bc50" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" vectorEffect="non-scaling-stroke">
          <path d="M-10 4h20l-3 6H-7Z" />
          <path d="M0-10v14M-6-4h12M-4-4l4-6 4 6" />
        </g>
      )}
      <g className="signed-out-route-label" transform="translate(34 -4)">
        <text fill="#f7f2e6" fontSize="15" fontWeight="600">{stop.title}</text>
        <text y="20" fill="#d2d8ce" fontSize="13">{stop.subtitle}</text>
      </g>
    </g>
  );
}

export function ExpeditionRouteMap() {
  return (
    <div className="signed-out-map">
      <div className="signed-out-map__heading">
        <strong>ALGONQUIN CANOE TRIP</strong>
        <span>
          <svg viewBox="0 0 18 18" aria-hidden="true">
            <path d="M3 16 15 2M4 2l12 12M6 4l-3 6m9 4 3-6" />
          </svg>
          3 nights <i aria-hidden="true" /> 23 km
        </span>
      </div>

      <svg className="signed-out-map__canvas" viewBox="0 0 560 720" preserveAspectRatio="xMidYMid slice" focusable="false">
        <defs>
          <filter id="landing-map-soft-shadow" x="-30%" y="-30%" width="160%" height="160%">
            <feDropShadow dx="0" dy="3" stdDeviation="5" floodColor="#020b08" floodOpacity="0.65" />
          </filter>
        </defs>

        <path
          className="signed-out-map__route-shadow"
          d="M76 607C125 589 130 545 166 523c43-27 90 23 132 7 35-14 32-51 1-67-34-17-82-1-107-30-26-31-8-82 18-105 35-31 85-33 111-73 16-25 21-55 17-68"
          fill="none"
          stroke="#05130e"
          strokeLinecap="round"
          strokeWidth="7"
          vectorEffect="non-scaling-stroke"
        />
        <path
          className="signed-out-map__route"
          d="M76 607C125 589 130 545 166 523c43-27 90 23 132 7 35-14 32-51 1-67-34-17-82-1-107-30-26-31-8-82 18-105 35-31 85-33 111-73 16-25 21-55 17-68"
          fill="none"
          stroke="#efad27"
          strokeDasharray="5 11"
          strokeLinecap="round"
          strokeWidth="3"
          vectorEffect="non-scaling-stroke"
        />

        {routeStops.map((stop) => <RouteMarker key={stop.title} stop={stop} />)}

        <g className="signed-out-map__compass" transform="translate(480 75)">
          <circle r="30" fill="rgba(7, 27, 20, .82)" stroke="#9f8b50" strokeWidth="1" vectorEffect="non-scaling-stroke" />
          <circle r="21" fill="none" stroke="#6f754d" strokeWidth="0.8" vectorEffect="non-scaling-stroke" />
          <path d="M0-18 5 2 0 8-5 2Z" fill="#e7b54b" />
          <path d="M0 18 4-2 0-8-4-2Z" fill="#77935a" />
          <text y="-37" fill="#e6bd66" fontSize="10" textAnchor="middle">N</text>
          <text y="45" fill="#e6bd66" fontSize="9" textAnchor="middle">S</text>
        </g>
      </svg>
    </div>
  );
}

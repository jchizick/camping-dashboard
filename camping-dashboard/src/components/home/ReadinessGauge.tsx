const READINESS_LANDMARKS = [25, 50, 75, 100] as const;
const READINESS_TICKS = Array.from({ length: 19 }, (_, index) => index + 1);

export default function ReadinessGauge({
  score,
  statusLabel,
}: {
  score: number;
  statusLabel: string;
}) {
  const markerEdge = score === 0 ? 'start' : score === 100 ? 'end' : 'middle';
  const scorePosition = `${score}%`;

  return (
    <div
      className="mobile-readiness-gauge"
      data-readiness-gauge
      role="progressbar"
      aria-label="Overall trip readiness"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={score}
      aria-valuetext={`${score}% · ${statusLabel}`}
    >
      <div className="mobile-readiness-gauge__track" aria-hidden="true">
        <span
          className="mobile-readiness-gauge__fill"
          data-readiness-fill
          style={{ clipPath: `inset(0 ${100 - score}% 0 0)` }}
        />
        <span className="mobile-readiness-gauge__ticks">
          {READINESS_TICKS.map((tick) => (
            <span
              className={tick % 5 === 0 ? 'is-landmark' : undefined}
              key={tick}
            />
          ))}
        </span>
        <span
          className="mobile-readiness-gauge__marker"
          data-edge={markerEdge}
          data-readiness-marker
          style={{ left: scorePosition }}
        >
          <span
            aria-hidden="true"
            className="mobile-readiness-gauge__marker-notch"
            data-readiness-marker-notch
          />
        </span>
      </div>
      <span className="mobile-readiness-gauge__landmarks" aria-hidden="true">
        {READINESS_LANDMARKS.map((landmark) => (
          <span key={landmark}>{landmark}%</span>
        ))}
      </span>
    </div>
  );
}

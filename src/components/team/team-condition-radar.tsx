import { resolveDistinctTeamColors } from "@/lib/utils/team-colors";

type RadarMetric = {
  label: string;
  score: number;
};

type TeamConditionRadarProps = {
  teamLabel: string;
  teamColor: string;
  teamSecondaryColor: string;
  teamMetrics: RadarMetric[];
  teamOverallScore: number;
  opponentLabel: string;
  opponentColor: string;
  opponentSecondaryColor: string;
  opponentMetrics: RadarMetric[];
  opponentOverallScore: number;
};

const SIZE = 320;
const CENTER = SIZE / 2;
const OUTER_RADIUS = 108;
const LABEL_RADIUS = 136;
const GRID_LEVELS = [0.2, 0.4, 0.6, 0.8, 1];
const VIEWBOX_PADDING = 40;

function pointAt(index: number, ratio: number, total: number) {
  const angle = -Math.PI / 2 + (Math.PI * 2 * index) / total;
  const radius = OUTER_RADIUS * ratio;
  return {
    x: CENTER + Math.cos(angle) * radius,
    y: CENTER + Math.sin(angle) * radius,
  };
}

function labelPoint(index: number, total: number) {
  const angle = -Math.PI / 2 + (Math.PI * 2 * index) / total;
  return {
    x: CENTER + Math.cos(angle) * LABEL_RADIUS,
    y: CENTER + Math.sin(angle) * LABEL_RADIUS,
  };
}

function polygonPoints(total: number, ratio: number) {
  return Array.from({ length: total }, (_, index) => pointAt(index, ratio, total))
    .map((point) => `${point.x},${point.y}`)
    .join(" ");
}

function metricPolygonPoints(metrics: RadarMetric[]) {
  return metrics
    .map((metric, index) => pointAt(index, metric.score / 100, metrics.length))
    .map((point) => `${point.x},${point.y}`)
    .join(" ");
}

export function TeamConditionRadar({
  teamLabel,
  teamColor,
  teamSecondaryColor,
  teamMetrics,
  teamOverallScore,
  opponentLabel,
  opponentColor,
  opponentSecondaryColor,
  opponentMetrics,
  opponentOverallScore,
}: TeamConditionRadarProps) {
  const { leftColor, rightColor } = resolveDistinctTeamColors(
    {
      primaryColor: teamColor,
      secondaryColor: teamSecondaryColor,
    },
    {
      primaryColor: opponentColor,
      secondaryColor: opponentSecondaryColor,
    },
  );

  return (
    <div className="rounded-[24px] border border-line/80 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.96),rgba(241,245,249,0.94))] px-2 py-3 shadow-panel sm:rounded-[32px] sm:px-4 sm:py-5">
      <svg
        viewBox={`-${VIEWBOX_PADDING} -${VIEWBOX_PADDING} ${SIZE + VIEWBOX_PADDING * 2} ${SIZE + VIEWBOX_PADDING * 2}`}
        className="mx-auto h-[200px] w-full max-w-[200px] overflow-visible sm:h-[320px] sm:max-w-[320px]"
      >
        {GRID_LEVELS.map((level) => (
          <polygon
            key={level}
            points={polygonPoints(teamMetrics.length, level)}
            fill="none"
            stroke="rgba(148,163,184,0.28)"
            strokeWidth="1"
          />
        ))}

        {[
          { value: 25, ratio: 0.25 },
          { value: 50, ratio: 0.5 },
          { value: 75, ratio: 0.75 },
          { value: 100, ratio: 1 },
        ].map(({ value, ratio }) => (
          <text
            key={value}
            x={CENTER - 10}
            y={CENTER - OUTER_RADIUS * ratio + 12}
            textAnchor="end"
            className="fill-slate-400 text-[9px] font-medium"
          >
            {value}
          </text>
        ))}

        {teamMetrics.map((metric, index) => {
          const end = pointAt(index, 1, teamMetrics.length);
          const label = labelPoint(index, teamMetrics.length);
          const textAnchor =
            Math.abs(label.x - CENTER) < 18 ? "middle" : label.x < CENTER ? "end" : "start";
          return (
            <g key={metric.label}>
              <line
                x1={CENTER}
                y1={CENTER}
                x2={end.x}
                y2={end.y}
                stroke="rgba(148,163,184,0.32)"
                strokeWidth="1"
              />
              <text
                x={label.x}
                y={label.y}
                textAnchor={textAnchor}
                dominantBaseline="middle"
                className="fill-slate-500 text-[10px] font-medium sm:text-[11px]"
              >
                {metric.label}
              </text>
            </g>
          );
        })}

        <polygon
          points={metricPolygonPoints(opponentMetrics)}
          fill={rightColor}
          fillOpacity="0.12"
          stroke={rightColor}
          strokeWidth="2.5"
        />
        <polygon
          points={metricPolygonPoints(teamMetrics)}
          fill={leftColor}
          fillOpacity="0.22"
          stroke={leftColor}
          strokeWidth="3"
        />

        {teamMetrics.map((metric, index) => {
          const teamPoint = pointAt(index, metric.score / 100, teamMetrics.length);
          const opponentPoint = pointAt(index, opponentMetrics[index]?.score ? opponentMetrics[index].score / 100 : 0, opponentMetrics.length);
          return (
            <g key={`${metric.label}-points`}>
              <circle cx={teamPoint.x} cy={teamPoint.y} r="4.5" fill={leftColor} />
              <circle cx={opponentPoint.x} cy={opponentPoint.y} r="4" fill={rightColor} />
            </g>
          );
        })}

        <circle cx={CENTER} cy={CENTER} r="26" fill="rgba(255,255,255,0.96)" stroke="rgba(148,163,184,0.25)" />
        <text x={CENTER} y={CENTER - 6} textAnchor="middle" className="fill-slate-500 text-[9px] font-semibold uppercase tracking-[0.18em]">
          Power
        </text>
        <text x={CENTER} y={CENTER + 10} textAnchor="middle" className="fill-slate-900 text-[11px] font-semibold">
          {teamLabel} {teamOverallScore}
        </text>
        <text x={CENTER} y={CENTER + 23} textAnchor="middle" className="fill-slate-500 text-[10px] font-medium">
          {opponentLabel} {opponentOverallScore}
        </text>
      </svg>

      <div className="mt-2 flex flex-wrap items-center justify-center gap-2 text-[10px] text-muted sm:mt-3 sm:gap-3 sm:text-xs">
        <span className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: leftColor }} />
          {teamLabel}
        </span>
        <span className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: rightColor }} />
          {opponentLabel}
        </span>
      </div>
    </div>
  );
}

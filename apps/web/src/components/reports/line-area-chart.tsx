import { Card, CardContent, CardHeader, CardTitle } from "@propninja/ui/card";

type LineAreaPoint = {
  label: string;
  value: number;
};

export function LineAreaChart({
  title,
  points,
  selectedLabel,
  onPointClick,
}: {
  title: string;
  points: LineAreaPoint[];
  selectedLabel?: string;
  onPointClick?: (label: string) => void;
}) {
  const width = 600;
  const height = 220;
  const padding = { top: 16, right: 16, bottom: 32, left: 40 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  const max = Math.max(...points.map((point) => point.value), 1);

  const coords = points.map((point, index) => {
    const x =
      points.length === 1
        ? padding.left + chartWidth / 2
        : padding.left + (index / (points.length - 1)) * chartWidth;
    const y = padding.top + chartHeight - (point.value / max) * chartHeight;
    return { x, y, label: point.label, value: point.value };
  });

  const linePath = coords
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
    .join(" ");

  const areaPath =
    coords.length > 0
      ? `${linePath} L ${coords[coords.length - 1]!.x} ${padding.top + chartHeight} L ${coords[0]!.x} ${padding.top + chartHeight} Z`
      : "";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {points.length === 0 ? (
          <p className="text-sm text-muted-foreground">No data for this period.</p>
        ) : (
          <div className="overflow-x-auto">
            <svg
              viewBox={`0 0 ${width} ${height}`}
              className="w-full min-w-[320px]"
              role="img"
              aria-label={title}
            >
              <title>{title}</title>
              {[0, 0.25, 0.5, 0.75, 1].map((tick) => {
                const y = padding.top + chartHeight - tick * chartHeight;
                const value = Math.round(tick * max);
                return (
                  <g key={tick}>
                    <line
                      x1={padding.left}
                      y1={y}
                      x2={width - padding.right}
                      y2={y}
                      stroke="hsl(var(--border))"
                      strokeDasharray="4 4"
                    />
                    <text
                      x={padding.left - 8}
                      y={y + 4}
                      textAnchor="end"
                      className="fill-muted-foreground text-[10px]"
                    >
                      {value}
                    </text>
                  </g>
                );
              })}
              {areaPath ? (
                <path d={areaPath} fill="hsl(var(--primary) / 0.15)" stroke="none" />
              ) : null}
              {linePath ? (
                <path d={linePath} fill="none" stroke="hsl(var(--primary))" strokeWidth={2} />
              ) : null}
              {coords.map((point) => {
                const selected = selectedLabel === point.label;
                return (
                  <g
                    key={point.label}
                    role={onPointClick ? "button" : undefined}
                    tabIndex={onPointClick ? 0 : undefined}
                    style={{ cursor: onPointClick ? "pointer" : undefined }}
                    onClick={() => onPointClick?.(point.label)}
                    onKeyDown={(event) => {
                      if (onPointClick && (event.key === "Enter" || event.key === " ")) {
                        event.preventDefault();
                        onPointClick(point.label);
                      }
                    }}
                  >
                    <circle
                      cx={point.x}
                      cy={point.y}
                      r={selected ? 7 : 5}
                      fill={selected ? "hsl(var(--primary))" : "hsl(var(--primary) / 0.8)"}
                      stroke={selected ? "hsl(var(--foreground))" : "none"}
                      strokeWidth={2}
                    />
                    <text
                      x={point.x}
                      y={height - 8}
                      textAnchor="middle"
                      className="fill-muted-foreground text-[10px]"
                    >
                      {point.label.slice(5)}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

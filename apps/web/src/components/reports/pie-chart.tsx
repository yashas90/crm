import { Card, CardContent, CardHeader, CardTitle } from "@propninja/ui/card";

type PieChartItem = {
  label: string;
  value: number;
};

const COLORS = [
  "hsl(var(--primary))",
  "hsl(142 76% 36%)",
  "hsl(38 92% 50%)",
  "hsl(0 84% 60%)",
  "hsl(262 83% 58%)",
  "hsl(199 89% 48%)",
];

function buildConicGradient(items: PieChartItem[]) {
  const total = items.reduce((sum, item) => sum + item.value, 0);
  if (total === 0) return "conic-gradient(hsl(var(--muted)) 0deg 360deg)";

  let current = 0;
  const stops: string[] = [];

  items.forEach((item, index) => {
    const slice = (item.value / total) * 360;
    const color = COLORS[index % COLORS.length];
    stops.push(`${color} ${current}deg ${current + slice}deg`);
    current += slice;
  });

  return `conic-gradient(${stops.join(", ")})`;
}

export function PieChart({ title, items }: { title: string; items: PieChartItem[] }) {
  const total = items.reduce((sum, item) => sum + item.value, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {items.length === 0 || total === 0 ? (
          <p className="text-sm text-muted-foreground">No data for this period.</p>
        ) : (
          <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start">
            <div
              className="h-40 w-40 shrink-0 rounded-full"
              style={{ background: buildConicGradient(items) }}
              role="img"
              aria-label={title}
            />
            <ul className="w-full space-y-2">
              {items.map((item, index) => (
                <li key={item.label} className="flex items-center justify-between gap-2 text-sm">
                  <span className="flex items-center gap-2">
                    <span
                      className="inline-block h-3 w-3 rounded-full"
                      style={{ backgroundColor: COLORS[index % COLORS.length] }}
                    />
                    <span className="capitalize">{item.label}</span>
                  </span>
                  <span className="font-medium">
                    {item.value} ({Math.round((item.value / total) * 100)}%)
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

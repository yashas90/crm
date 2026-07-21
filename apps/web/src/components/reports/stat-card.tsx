import { Card, CardContent, CardHeader, CardTitle } from "@propninja/ui/card";

export function StatCard({
  title,
  value,
  hint,
}: {
  title: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium normal-case tracking-normal text-muted-foreground">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1">
        <p className="break-all text-3xl font-bold tabular-nums text-foreground">
          {typeof value === "number" ? value.toLocaleString() : value}
        </p>
        {hint ? <p className="text-xs leading-snug text-muted-foreground">{hint}</p> : null}
      </CardContent>
    </Card>
  );
}

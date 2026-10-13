"use client";

import { QUARTER_CODES } from "@/lib/tcf-form";
import { Button } from "@propninja/ui/button";

export function QuarterSwitcher({
  quarter,
  onChange,
}: {
  quarter: string;
  onChange: (quarter: string) => void;
}) {
  const [yearText, code] = quarter.split("-");
  const year = Number(yearText) || new Date().getFullYear();

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button type="button" variant="outline" onClick={() => onChange(`${year - 1}-${code}`)}>
        {year - 1}
      </Button>
      <span className="text-sm font-semibold">{year}</span>
      <Button type="button" variant="outline" onClick={() => onChange(`${year + 1}-${code}`)}>
        {year + 1}
      </Button>
      {QUARTER_CODES.map((item) => (
        <Button
          key={item}
          type="button"
          variant={item === code ? "default" : "outline"}
          onClick={() => onChange(`${year}-${item}`)}
        >
          {item}
        </Button>
      ))}
    </div>
  );
}

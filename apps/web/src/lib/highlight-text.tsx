import { cn } from "@propninja/ui/lib/utils";

function splitHighlight(text: string, query: string) {
  const trimmed = query.trim();
  if (!trimmed) return [{ text, highlight: false }] as const;

  const lowerText = text.toLowerCase();
  const lowerQuery = trimmed.toLowerCase();
  const parts: { text: string; highlight: boolean }[] = [];
  let start = 0;
  let index = lowerText.indexOf(lowerQuery, start);

  while (index !== -1) {
    if (index > start) parts.push({ text: text.slice(start, index), highlight: false });
    parts.push({ text: text.slice(index, index + trimmed.length), highlight: true });
    start = index + trimmed.length;
    index = lowerText.indexOf(lowerQuery, start);
  }

  if (start < text.length) parts.push({ text: text.slice(start), highlight: false });
  return parts;
}

export function HighlightText({
  text,
  query,
  className,
  highlightClassName = "rounded bg-yellow-200 px-0.5 text-foreground dark:bg-yellow-500/30",
}: {
  text: string;
  query?: string;
  className?: string;
  highlightClassName?: string;
}) {
  if (!query?.trim()) {
    return <span className={className}>{text}</span>;
  }

  const parts = splitHighlight(text, query);
  return (
    <span className={className}>
      {parts.map((part, index) =>
        part.highlight ? (
          <mark key={`${part.text}-${index}`} className={cn(highlightClassName)}>
            {part.text}
          </mark>
        ) : (
          <span key={`${part.text}-${index}`}>{part.text}</span>
        ),
      )}
    </span>
  );
}

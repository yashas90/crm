"use client";

import { formatINRDigits, parseINR } from "@propninja/types/money";
import { cn } from "@propninja/ui/lib/utils";
import { useEffect, useState } from "react";

type InrInputProps = {
  value: number | null;
  onChange: (value: number | null) => void;
  className?: string;
  id?: string;
  placeholder?: string;
};

/** ₹ prefix, Indian commas while typing, stores a whole-rupee integer. */
export function InrInput({ value, onChange, className, id, placeholder }: InrInputProps) {
  const [text, setText] = useState(value == null ? "" : formatINRDigits(value));

  useEffect(() => {
    setText(value == null ? "" : formatINRDigits(value));
  }, [value]);

  return (
    <label
      className={cn("flex h-9 items-center gap-1 rounded-md border bg-transparent px-2", className)}
    >
      <span className="text-sm text-slate-500">₹</span>
      <input
        id={id}
        inputMode="numeric"
        className="w-full bg-transparent text-sm outline-none"
        placeholder={placeholder ?? "0"}
        value={text}
        onChange={(event) => {
          const next = event.target.value;
          if (next.trim() === "") {
            setText("");
            onChange(null);
            return;
          }
          const parsed = parseINR(next);
          if (parsed == null) return;
          setText(formatINRDigits(parsed));
          onChange(parsed);
        }}
      />
    </label>
  );
}

"use client";

import { PHONE_PREFIXES, type PhonePrefix } from "@/lib/user-form-schema";
import { Input } from "@propninja/ui/input";
import { Label } from "@propninja/ui/label";
import { cn } from "@propninja/ui/lib/utils";

const selectClass =
  "flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

type PhoneFieldProps = {
  label: string;
  required?: boolean;
  prefix: PhonePrefix;
  number: string;
  onPrefixChange: (value: PhonePrefix) => void;
  onNumberChange: (value: string) => void;
  error?: string;
  readOnly?: boolean;
};

export function PhoneField({
  label,
  required,
  prefix,
  number,
  onPrefixChange,
  onNumberChange,
  error,
  readOnly,
}: PhoneFieldProps) {
  return (
    <div className="space-y-2">
      <Label>
        {label}
        {required ? <span className="text-destructive"> *</span> : null}
      </Label>
      <div className="flex gap-2">
        <select
          className={cn(selectClass, "w-[5.5rem] shrink-0")}
          value={prefix}
          disabled={readOnly}
          onChange={(event) => onPrefixChange(event.target.value as PhonePrefix)}
        >
          {PHONE_PREFIXES.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
        <Input
          type="tel"
          inputMode="numeric"
          placeholder="Phone number"
          value={number}
          disabled={readOnly}
          onChange={(event) => onNumberChange(event.target.value)}
          className="flex-1"
        />
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}

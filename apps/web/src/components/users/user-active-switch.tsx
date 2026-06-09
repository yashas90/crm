"use client";

import { ProjectAvailabilitySwitch } from "@/components/projects/project-availability-switch";
import { Label } from "@propninja/ui/label";

type UserActiveSwitchProps = {
  checked: boolean;
  disabled?: boolean;
  onCheckedChange: (checked: boolean) => void;
};

export function UserActiveSwitch({ checked, disabled, onCheckedChange }: UserActiveSwitchProps) {
  return (
    <div className="flex items-center gap-3">
      <Label htmlFor="user-active-switch" className="text-sm text-muted-foreground">
        Active
      </Label>
      <ProjectAvailabilitySwitch
        checked={checked}
        disabled={disabled}
        onCheckedChange={onCheckedChange}
        label="Toggle user active status"
      />
    </div>
  );
}

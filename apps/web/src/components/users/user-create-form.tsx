"use client";

import { useCreateUser } from "@/hooks/use-users";
import { getErrorMessage } from "@/lib/errors";
import { Button } from "@propninja/ui/button";
import { Input } from "@propninja/ui/input";
import { Label } from "@propninja/ui/label";
import { useState } from "react";

const CREATE_ROLES = [
  { value: "Manager", label: "Manager" },
  { value: "Basic", label: "Basic" },
] as const;

type UserCreateFormProps = {
  onSuccess?: () => void;
};

export function UserCreateForm({ onSuccess }: UserCreateFormProps) {
  const createUser = useCreateUser();
  const [username, setUsername] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [roleLabel, setRoleLabel] = useState<"Manager" | "Basic">("Basic");
  const [error, setError] = useState<string | null>(null);

  const selectClass =
    "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm";

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    createUser.mutate(
      {
        username,
        name: name || undefined,
        email,
        workEmail: email,
        password,
        roleLabel,
        phone: phone || undefined,
      },
      {
        onSuccess: () => {
          setUsername("");
          setName("");
          setEmail("");
          setPhone("");
          setPassword("");
          setRoleLabel("Basic");
          setError(null);
          onSuccess?.();
        },
        onError: (err) => {
          setError(getErrorMessage(err, "Failed to create user"));
        },
      },
    );
  }

  return (
    <form className="grid gap-4 md:grid-cols-2" onSubmit={handleSubmit}>
      <div className="space-y-2">
        <Label htmlFor="user-username">Username</Label>
        <Input
          id="user-username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="jane.doe"
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="user-name">Full name</Label>
        <Input id="user-name" value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="user-email">Email</Label>
        <Input
          id="user-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="user-phone">Phone</Label>
        <Input
          id="user-phone"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="+919876543210"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="user-role">Role</Label>
        <select
          id="user-role"
          className={selectClass}
          value={roleLabel}
          onChange={(e) => setRoleLabel(e.target.value as "Manager" | "Basic")}
        >
          {CREATE_ROLES.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-2 md:col-span-2">
        <Label htmlFor="user-password">Temporary password</Label>
        <Input
          id="user-password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          minLength={6}
          required
        />
        <p className="text-xs text-muted-foreground">
          Share this password securely. The user can sign in immediately.
        </p>
      </div>
      {error ? <p className="text-sm text-destructive md:col-span-2">{error}</p> : null}
      <div className="md:col-span-2">
        <Button type="submit" disabled={createUser.isPending}>
          {createUser.isPending ? "Creating..." : "Create user"}
        </Button>
      </div>
    </form>
  );
}

export function deriveUsernameFromEmail(email: string): string {
  const local = email.split("@")[0] ?? "user";
  const sanitized = local
    .replace(/[^a-zA-Z0-9._-]/g, ".")
    .replace(/\.+/g, ".")
    .replace(/^\.|\.$/g, "");
  const base = (sanitized || "user").slice(0, 45);
  return base.toLowerCase();
}

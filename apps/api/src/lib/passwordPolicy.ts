import { verifyPassword } from "./password.js";

export type PasswordPolicyFailure = {
  valid: false;
  errors: string[];
};

export type PasswordPolicyResult = { valid: true } | PasswordPolicyFailure;

export function validatePasswordPolicy(password: string): PasswordPolicyResult {
  const errors: string[] = [];

  if (password.length < 8) {
    errors.push("Password must be at least 8 characters.");
  }
  if (!/[A-Z]/.test(password)) {
    errors.push("Password must contain at least one uppercase letter.");
  }
  if (!/[0-9]/.test(password)) {
    errors.push("Password must contain at least one number.");
  }
  if (!/[^A-Za-z0-9]/.test(password)) {
    errors.push("Password must contain at least one special character.");
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return { valid: true };
}

export async function passwordMatchesHistory(
  plain: string,
  previousHashes: string[],
): Promise<boolean> {
  for (const hash of previousHashes) {
    if (await verifyPassword(plain, hash)) {
      return true;
    }
  }
  return false;
}

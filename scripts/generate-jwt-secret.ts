#!/usr/bin/env tsx
/**
 * Generate a cryptographically secure JWT secret for Railway / production.
 *
 * Usage:
 *   pnpm exec tsx scripts/generate-jwt-secret.ts
 *
 * Equivalent one-liner:
 *   node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
 */

import { randomBytes } from "node:crypto";

console.log("node -e \"console.log(require('crypto').randomBytes(64).toString('hex'))\"");
console.log(randomBytes(64).toString("hex"));

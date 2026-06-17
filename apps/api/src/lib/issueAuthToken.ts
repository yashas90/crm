import { randomUUID } from "node:crypto";
import { SignJWT } from "jose";
import type { AuthUser } from "../middleware/auth.js";
import { SINGLE_TENANT_ORG_ID } from "./constants.js";
import { getJwtSecret } from "./jwt.js";

export async function issueAuthToken(user: {
  id: string;
  email: string;
  name: string;
  role: AuthUser["role"];
}): Promise<{ token: string; jti: string }> {
  const jti = randomUUID();
  const token = await new SignJWT({
    sub: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    orgId: SINGLE_TENANT_ORG_ID,
    jti,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(getJwtSecret());

  return { token, jti };
}

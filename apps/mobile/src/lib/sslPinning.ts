import { initializeSslPinning, isSslPinningAvailable } from "react-native-ssl-public-key-pinning";

/** Railway *.up.railway.app leaf + current intermediate (rotated 2026-07). */
const RAILWAY_PUBLIC_KEY_HASHES = [
  "hORJtOUv6S5sVpxykVdj7ceRoUfeLhICfOGA0n68co0=", // leaf *.up.railway.app
  "brzvtCELCIZUo4sD/qPX0ccRtPsd3DY6RfmxpOU9oB4=", // YE1 intermediate
  "C5+lpZ7tcVwmwQIMcRtPbsQtWLABXhQzejna0wHFr8M=", // ISRG Root X1
] as const;

function pinningDomainFromApiUrl(apiUrl: string): string | null {
  try {
    return new URL(apiUrl).hostname;
  } catch {
    return null;
  }
}

/**
 * Pin the production API host. Skipped in Expo Go / when the native module is unavailable.
 * Must run before any API fetch — see index.js.
 */
export async function initSslPinning(apiUrl: string): Promise<void> {
  if (__DEV__ && process.env.EXPO_PUBLIC_DISABLE_SSL_PINNING === "1") {
    return;
  }

  if (!isSslPinningAvailable()) {
    return;
  }

  const hostname = pinningDomainFromApiUrl(apiUrl);
  if (!hostname) return;

  const extraHashes = process.env.EXPO_PUBLIC_API_CERT_SHA256?.split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  const publicKeyHashes = [...(extraHashes?.length ? extraHashes : RAILWAY_PUBLIC_KEY_HASHES)];

  await initializeSslPinning({
    [hostname]: {
      includeSubdomains: true,
      publicKeyHashes,
    },
  });
}

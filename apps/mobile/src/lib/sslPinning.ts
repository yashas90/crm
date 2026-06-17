import { initializeSslPinning, isSslPinningAvailable } from "react-native-ssl-public-key-pinning";

/** Railway *.up.railway.app leaf + Let's Encrypt E7 intermediate (backup). */
const RAILWAY_PUBLIC_KEY_HASHES = [
  "sGDbTDZa6e6YT2TE9XG0KNYPBuV/4YoqFrebzjQs1Ss=",
  "y7xVm0TVJNahMr2sZydE2jQH8SquXV9yLF9seROHHHU=",
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

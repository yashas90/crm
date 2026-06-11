const { withAndroidManifest } = require("expo/config-plugins");

/** Android 11+ package visibility — required for Linking / tel: and WhatsApp intents. */
function withAndroidDialerQueries(config) {
  return withAndroidManifest(config, (modConfig) => {
    const manifest = modConfig.modResults.manifest;
    if (!manifest.queries) {
      manifest.queries = [{}];
    }

    const queries = manifest.queries[0];
    if (!queries.intent) queries.intent = [];
    if (!queries.package) queries.package = [];

    const intents = [
      { action: "android.intent.action.DIAL", scheme: "tel" },
      { action: "android.intent.action.VIEW", scheme: "tel" },
      { action: "android.intent.action.VIEW", scheme: "whatsapp" },
      { action: "android.intent.action.VIEW", scheme: "https", host: "wa.me" },
      { action: "android.intent.action.VIEW", scheme: "https", host: "api.whatsapp.com" },
    ];

    for (const { action, scheme, host } of intents) {
      queries.intent.push({
        action: [{ $: { "android:name": action } }],
        data: [{ $: { "android:scheme": scheme, ...(host ? { "android:host": host } : {}) } }],
      });
    }

    for (const pkg of ["com.whatsapp", "com.whatsapp.w4b"]) {
      queries.package.push({ $: { "android:name": pkg } });
    }

    return modConfig;
  });
}

module.exports = withAndroidDialerQueries;

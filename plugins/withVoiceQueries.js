const { withAndroidManifest } = require('@expo/config-plugins');

module.exports = function withVoiceQueries(config) {
  return withAndroidManifest(config, async (config) => {
    const androidManifest = config.modResults.manifest;
    if (!androidManifest.queries) {
      androidManifest.queries = [];
    }
    const queries = androidManifest.queries;

    // 1. Thêm intent RecognitionService
    const hasRecognitionService = queries.some(
      (q) => q.intent && q.intent.some((i) => i.action && i.action.some((a) => a.$['android:name'] === 'android.speech.RecognitionService'))
    );
    if (!hasRecognitionService) {
      queries.push({
        intent: [
          {
            action: [{ $: { 'android:name': 'android.speech.RecognitionService' } }],
          },
        ],
      });
    }

    // 2. Thêm package Google
    const packagesToAdd = ['com.google.android.googlequicksearchbox', 'com.google.android.tts'];
    for (const pkg of packagesToAdd) {
      const hasPkg = queries.some((q) => q.package && q.package.some((p) => p.$['android:name'] === pkg));
      if (!hasPkg) {
        queries.push({
          package: [{ $: { 'android:name': pkg } }],
        });
      }
    }

    return config;
  });
};

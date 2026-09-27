// Sentry's Expo metro config: adds debug IDs to bundles so crash stack traces
// can be symbolicated with the source maps uploaded during EAS builds.
// Otherwise identical to Expo's default metro config.
const { getSentryExpoConfig } = require('@sentry/react-native/metro');

module.exports = getSentryExpoConfig(__dirname);

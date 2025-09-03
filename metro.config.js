const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);

// Selective polyfills - remove Node http/https shims which can break RN networking
config.resolver = {
  ...config.resolver,
  extraNodeModules: {
    // Minimal shims used by some deps without impacting RN fetch
    events: require.resolve("events"),
    url: require.resolve("url"),
    util: require.resolve("util"),
    querystring: require.resolve("qs"),
    
    // Removing these that may cause global corruption:
    // crypto: require.resolve("crypto-browserify"), // Use react-native-get-random-values instead
    // net: require.resolve("net-browserify"), // Not needed for HTTP requests
    // tls: require.resolve("tls-browserify"), // Handled by HTTPS polyfill
    // zlib: require.resolve("browserify-zlib"), // Not typically needed
    // path: require.resolve("path-browserify"), // May cause issues
    // fs: require.resolve("browserify-fs"), // Not available in React Native
  },
};

module.exports = withNativeWind(config, { input: "./global.css" });

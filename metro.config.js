const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

// eslint-disable-next-line no-undef
const config = getDefaultConfig(__dirname);

// Ensure modules run before the main module (works across Metro versions)
config.serializer = {
  ...config.serializer,
  getModulesRunBeforeMainModule: () => [require.resolve('./polyfills/promise.js')],
};

// Add resolver configuration
config.resolver = {
	...config.resolver,
	extraNodeModules: {
		...config.resolver.extraNodeModules,
		stream: require.resolve("stream-browserify"),
		events: require.resolve("events"),
		http: require.resolve("http-browserify"),
		crypto: require.resolve("crypto-browserify"),
		https: require.resolve("https-browserify"),
		net: require.resolve("net-browserify"),
		tls: require.resolve("tls-browserify"),
		url: require.resolve("url"),
		zlib: require.resolve("browserify-zlib"),
		util: require.resolve("util"),
		assert: require.resolve("assert"),
		querystring: require.resolve("qs"),
		path: require.resolve("path-browserify"),
		fs: require.resolve("browserify-fs"),
	},
};

module.exports = withNativeWind(config, { input: "./global.css" });

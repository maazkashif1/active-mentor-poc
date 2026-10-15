const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * @type {import('@react-native/metro-config').MetroConfig}
 */
const defaultConfig = getDefaultConfig(__dirname);

const config = {
  resolver: {
    assetExts: [...defaultConfig.resolver.assetExts, 'tflite'],
    // @react-native-community/blur uses a private RN internal path; disable
    // strict package exports so Metro falls back to file-based resolution silently.
    unstable_enablePackageExports: false,
  },
};

module.exports = mergeConfig(defaultConfig, config);

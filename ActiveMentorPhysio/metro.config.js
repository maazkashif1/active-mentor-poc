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
    // Bundle .tflite models as assets so require('...model.tflite') works.
    assetExts: [...defaultConfig.resolver.assetExts, 'tflite'],
  },
};

module.exports = mergeConfig(defaultConfig, config);

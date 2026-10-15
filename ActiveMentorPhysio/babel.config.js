module.exports = {
  presets: ['module:@react-native/babel-preset'],
  // Required for VisionCamera v5 useFrameOutput worklets (react-native-worklets).
  // Must be the LAST plugin.
  plugins: ['react-native-worklets/plugin'],
};

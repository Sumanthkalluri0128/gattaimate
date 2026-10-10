const { getDefaultConfig } = require("expo/metro-config");

// Recent Expo SDKs configure workspace/monorepo support automatically.
// Keep this file minimal; add custom watchFolders only if Metro reports it is needed.
module.exports = getDefaultConfig(__dirname);

const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);

module.exports = withNativeWind(config, {
  projectRoot: __dirname,
  input: path.join(__dirname, "styles/global.css"),
  configPath: path.join(__dirname, "tailwind.config.js"),
});

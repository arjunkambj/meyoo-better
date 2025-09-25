/** @type {import('tailwindcss').Config} */
import heroUINativePlugin from "heroui-native/tailwind-plugin";

module.exports = {
  // NOTE: Update this to include the paths to all files that contain Nativewind classes.
  content: [
    "./components/**/*.{js,jsx,ts,tsx}",
    "./app/**/*.{js,jsx,ts,tsx}",
    "./node_modules/heroui-native/lib/**/*.{js,ts,jsx,tsx}",
    "../../node_modules/heroui-native/lib/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: "class",
  presets: [require("nativewind/preset")],
  theme: {
    extend: {},
  },
  plugins: [heroUINativePlugin],
};

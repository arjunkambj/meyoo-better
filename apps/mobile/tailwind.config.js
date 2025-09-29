import heroUINativePlugin from "heroui-native/tailwind-plugin";

/** @type {import('tailwindcss').Config} */

module.exports = {
  // NOTE: Update this to include the paths to all files that contain Nativewind classes.
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}",
    "./node_modules/heroui-native/lib/**/*.{js,ts,jsx,tsx}",
    "../../node_modules/heroui-native/lib/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: "class",
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "System", "ui-sans-serif", "sans-serif"],
        display: ["Inter", "System", "ui-sans-serif", "sans-serif"],
      },
      spacing: {
        15: "3.75rem",
        18: "4.5rem",
      },
      borderRadius: {
        xl: "1.125rem",
        "2xl": "1.5rem",
        "3xl": "2rem",
      },
      colors: {
        background: {
          DEFAULT: "#ffffff",
          dark: "#09090b",
        },
        surface: {
          1: "#ffffff",
          2: "#f4f4f5",
          3: "#e4e4e7",
          dark1: "#18181b",
          dark2: "#27272a",
          dark3: "#3f3f46",
        },
        brand: {
          indigo: "#6366f1",
          purple: "#7828c8",
        },
      },
    },
  },
  plugins: [heroUINativePlugin],
};

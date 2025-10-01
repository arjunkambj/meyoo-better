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
          DEFAULT: "hsl(var(--background))",
        },
        foreground: {
          DEFAULT: "hsl(var(--foreground))",
        },
        panel: {
          DEFAULT: "hsl(var(--panel))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        surface: {
          DEFAULT: "hsl(var(--surface))",
          foreground: "hsl(var(--surface-foreground))",
        },
        default: {
          50: "#fafafa",
          100: "#f4f4f5",
          200: "#e4e4e7",
          300: "#d4d4d8",
          400: "#a1a1aa",
          500: "#71717a",
          600: "#52525b",
          700: "#3f3f46",
          800: "#27272a",
          900: "#18181b",
          DEFAULT: "hsl(var(--default))",
          foreground: "hsl(var(--default-foreground))",
        },
        accent: {
          50: "#eef2ff",
          100: "#e0e7ff",
          200: "#c7d2fe",
          300: "#a5b4fc",
          400: "#818cf8",
          500: "#6366f1",
          600: "#4f46e5",
          700: "#4338ca",
          800: "#3730a3",
          900: "#312e81",
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
          soft: {
            DEFAULT: "hsl(var(--accent-soft))",
            foreground: "hsl(var(--accent-soft-foreground))",
          },
        },
        primary: {
          50: "#eef2ff",
          100: "#e0e7ff",
          200: "#c7d2fe",
          300: "#a5b4fc",
          400: "#818cf8",
          500: "#6366f1",
          600: "#4f46e5",
          700: "#4338ca",
          800: "#3730a3",
          900: "#312e81",
          DEFAULT: "#6366f1",
        },
        secondary: {
          50: "#eee4f8",
          100: "#d7bfef",
          200: "#bf99e5",
          300: "#a773db",
          400: "#904ed2",
          500: "#7828c8",
          600: "#6321a5",
          700: "#4e1a82",
          800: "#39135f",
          900: "#240c3c",
          DEFAULT: "#7828c8",
        },
        success: {
          DEFAULT: "hsl(var(--success))",
          foreground: "hsl(var(--success-foreground))",
        },
        warning: {
          DEFAULT: "hsl(var(--warning))",
          foreground: "hsl(var(--warning-foreground))",
        },
        danger: {
          DEFAULT: "hsl(var(--danger))",
          foreground: "hsl(var(--danger-foreground))",
        },
        border: {
          DEFAULT: "hsl(var(--border))",
        },
        divider: {
          DEFAULT: "hsl(var(--divider))",
        },
        link: {
          DEFAULT: "hsl(var(--link))",
        },
        focus: {
          DEFAULT: "#6366f1",
        },
        overlay: {
          DEFAULT: "#000000",
          dark: "#0a0a0a",
        },
        content1: {
          DEFAULT: "#fafafa",
        },
        content2: {
          DEFAULT: "#f4f4f5",
        },
        content3: {
          DEFAULT: "#e4e4e7",
        },
        content4: {
          DEFAULT: "#d4d4d8",
        },
      },
    },
  },
  plugins: [heroUINativePlugin],
};

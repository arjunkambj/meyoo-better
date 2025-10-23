import { heroui } from "@heroui/theme";

const heroConfig = heroui({
  themes: {
    light: {
      colors: {
        // Tailwind Zinc (neutral base)
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
          foreground: "#000000",
          DEFAULT: "#d4d4d8",
        },
        // Tailwind Indigo
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
          foreground: "#fff",
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
          foreground: "#fff",
          DEFAULT: "#7828c8",
        },
        success: {
          50: "#e2f8ec",
          100: "#b9efd1",
          200: "#91e5b5",
          300: "#68dc9a",
          400: "#40d27f",
          500: "#17c964",
          600: "#13a653",
          700: "#0f8341",
          800: "#0b5f30",
          900: "#073c1e",
          foreground: "#ffffff",
          DEFAULT: "#059669",
        },
        warning: {
          50: "#fef4e4",
          100: "#fce4bd",
          200: "#fad497",
          300: "#f9c571",
          400: "#f7b54a",
          500: "#f5a524",
          600: "#ca881e",
          700: "#9f6b17",
          800: "#744e11",
          900: "#4a320b",
          foreground: "#fff",
          DEFAULT: "#f5a524",
        },
        danger: {
          50: "#fee1eb",
          100: "#fbb8cf",
          200: "#f98eb3",
          300: "#f76598",
          400: "#f53b7c",
          500: "#f31260",
          600: "#c80f4f",
          700: "#9e0c3e",
          800: "#73092e",
          900: "#49051d",
          foreground: "#ffffff",
          DEFAULT: "#e11d48",
        },
        background: "#ffffff",
        foreground: "#000000",
        // Surface tokens aligned to zinc scale for clearer separation
        content1: {
          DEFAULT: "#fafafa",
          foreground: "#000000",
        },
        content2: {
          DEFAULT: "#f4f4f5", // zinc-100
          foreground: "#000000",
        },
        content3: {
          DEFAULT: "#e4e4e7", // zinc-200
          foreground: "#000000",
        },
        content4: {
          DEFAULT: "#d4d4d8", // zinc-300
          foreground: "#000000",
        },
        // Align borders with settings UI usage
        divider: "#e4e4e7", // zinc-200
        focus: "#6366f1",
        overlay: "#000000",
      },
    },
    dark: {
      colors: {
        // Tailwind Zinc inverted for dark
        default: {
          50: "#09090b",
          100: "#18181b",
          200: "#27272a",
          300: "#3f3f46",
          400: "#52525b",
          500: "#71717a",
          600: "#a1a1aa",
          700: "#d4d4d8",
          800: "#e4e4e7",
          900: "#fafafa",
          foreground: "#ffffff",
          DEFAULT: "#3f3f46",
        },
        // Tailwind Indigo inverted for dark
        primary: {
          50: "#312e81",
          100: "#3730a3",
          200: "#4338ca",
          300: "#4f46e5",
          400: "#6366f1",
          500: "#818cf8",
          600: "#a5b4fc",
          700: "#c7d2fe",
          800: "#e0e7ff",
          900: "#eef2ff",
          foreground: "#ffffff",
          DEFAULT: "#6366f1",
        },
        secondary: {
          50: "#240c3c",
          100: "#39135f",
          200: "#4e1a82",
          300: "#6321a5",
          400: "#7828c8",
          500: "#904ed2",
          600: "#a773db",
          700: "#bf99e5",
          800: "#d7bfef",
          900: "#eee4f8",
          foreground: "#ffffff",
          DEFAULT: "#7828c8",
        },
        success: {
          50: "#073c1e",
          100: "#0b5f30",
          200: "#0f8341",
          300: "#13a653",
          400: "#17c964",
          500: "#40d27f",
          600: "#68dc9a",
          700: "#91e5b5",
          800: "#b9efd1",
          900: "#e2f8ec",
          foreground: "#ffffff",
          DEFAULT: "#047857",
        },
        warning: {
          50: "#4a320b",
          100: "#744e11",
          200: "#9f6b17",
          300: "#ca881e",
          400: "#f5a524",
          500: "#f7b54a",
          600: "#f9c571",
          700: "#fad497",
          800: "#fce4bd",
          900: "#fef4e4",
          foreground: "#ffffff",
          DEFAULT: "#c2410c",
        },
        danger: {
          50: "#49051d",
          100: "#73092e",
          200: "#9e0c3e",
          300: "#c80f4f",
          400: "#f31260",
          500: "#f53b7c",
          600: "#f76598",
          700: "#f98eb3",
          800: "#fbb8cf",
          900: "#fee1eb",
          foreground: "#f4f4f5",
          DEFAULT: "#be123c",
        },
        background: "#000000",
        foreground: "#ffffff",
        content1: {
          DEFAULT: "#18181b", // zinc-100 (dark base surface)
          foreground: "#ffffff",
        },
        content2: {
          DEFAULT: "#27272a", // zinc-200
          foreground: "#ffffff",
        },
        content3: {
          DEFAULT: "#3f3f46", // zinc-300
          foreground: "#ffffff",
        },
        content4: {
          DEFAULT: "#52525b", // zinc-400
          foreground: "#ffffff",
        },
        // Align borders with settings UI usage
        divider: "#27272a", // zinc-800 -> subtle border on dark
        focus: "#6366f1",
        overlay: "#0a0a0a",
      },
    },
  },
  layout: {
    disabledOpacity: "0.5",
    boxShadow: {
      small: "none",
      medium: "none",
      large: "none",
    },
  },
});

export default heroConfig as unknown as typeof heroui;

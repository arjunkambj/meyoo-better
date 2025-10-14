import { config as base } from "@repo/eslint-config/base";

export default [
  ...base,
  {
    ignores: ["convex/_generated/**"],
  },
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
];

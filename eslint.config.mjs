import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "references/**",
    "next-env.d.ts",
  ]),
  {
    rules: {
      // Disabled: causes false positives on async data-fetching calls inside useEffect
      "react-hooks/set-state-in-effect": "off",
    },
  },
]);

export default eslintConfig;

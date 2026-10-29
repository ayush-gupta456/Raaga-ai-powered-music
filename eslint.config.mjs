import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([
    "dist/**",
    "dist-node/**",
    "public/assets/**",
    ".vinext/**",
    ".wrangler/**",
    ".sites-runtime/**",
    "outputs/**",
    "work/**",
  ]),
  // This client is served by Vite/Express, without the Next router or image optimizer.
  { files: ["components/authenticated-studio.tsx"], rules: { "@next/next/no-html-link-for-pages": "off", "@next/next/no-img-element": "off" } },
  { files: ["server/index.mjs"], rules: { "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }] } },
]);

export default eslintConfig;

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
    // LCI_DIST_DIR で切り替えた並行ビルドの出力
    ".next-*/**",
    "out/**",
    // public/monaco（postinstall でコピー）と public/sandbox の配布物
    "public/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;

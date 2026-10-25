import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // 並行ビルド用に出力先を切り替えられるようにする（既定は .next）
  distDir: process.env.LCI_DIST_DIR || ".next",
  // モノレポ: @lci/core を src の .ts のままバンドルする
  transpilePackages: ["@lci/core", "@lci/runner", "@lci/evaluator", "@lci/demo"],
  outputFileTracingRoot: path.join(import.meta.dirname, "../../"),
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  serverExternalPackages: ["dockerode"],
};

export default nextConfig;

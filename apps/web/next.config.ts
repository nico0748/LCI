import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // モノレポ: @lci/core を src の .ts のままバンドルする
  transpilePackages: ["@lci/core", "@lci/runner", "@lci/evaluator"],
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

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * Database drivers must stay OUT of the bundler and be required at runtime
   * from node_modules:
   *  • @electric-sql/pglite ships a .wasm + .data pair it resolves relative to
   *    its own package path — bundling rewrites that path and the engine fails
   *    to boot at runtime;
   *  • pg and @node-rs/argon2 load native/optional bindings the same way.
   * Marking them external is the supported way to keep those resolutions intact.
   */
  serverExternalPackages: ["@electric-sql/pglite", "pg", "@node-rs/argon2"],
};

export default nextConfig;

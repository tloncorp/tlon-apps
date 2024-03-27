import type { Config } from "drizzle-kit";
// This file is primarily used for supporting cross-platform migration generation.
// The output of the generate command is identical between the expo and
// better-sqlite3 drivers, the only difference being that the expo driver also
// generates a migrations.js file to serve as an entry point for the bundler. If
// we need project-specific configs to support other db functionality, we can
// add those separately.
export default {
  schema: "./src/db/schema.ts",
  out: "./public/drizzle",
  driver: "expo",
} satisfies Config;

import type { Config } from "drizzle-kit";

export default {
  schema: "./src/db/schema.ts",
  out: "./public/drizzle",
  driver: "expo",
} satisfies Config;

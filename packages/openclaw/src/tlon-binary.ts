import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";

export type ResolveModuleFn = (id: string) => string;
type ExistsFn = (path: string) => boolean;
type ReadFileFn = (path: string, encoding: BufferEncoding) => string;
type LogFn = (message: string) => void;

type SkillPackageJson = {
  bin?: string | Record<string, string>;
};

function findPluginPackageJsonPath(moduleDir: string, exists: ExistsFn): string | null {
  return [join(moduleDir, "package.json"), join(moduleDir, "..", "package.json")].find(exists) ?? null;
}

function resolveSkillBinPath(
  resolveModule: ResolveModuleFn,
  readFile: ReadFileFn,
): string | null {
  try {
    const skillPackageJsonPath = resolveModule("@tloncorp/tlon-skill/package.json");
    const skillPackageDir = dirname(skillPackageJsonPath);
    const skillPackageJson = JSON.parse(readFile(skillPackageJsonPath, "utf-8")) as SkillPackageJson;
    const relativeBin =
      typeof skillPackageJson.bin === "string"
        ? skillPackageJson.bin
        : skillPackageJson.bin?.tlon;

    return relativeBin ? join(skillPackageDir, relativeBin) : null;
  } catch {
    return null;
  }
}

export function resolveTlonBinary(options: {
  moduleDir: string;
  resolveModule: ResolveModuleFn;
  exists?: ExistsFn;
  readFile?: ReadFileFn;
  log?: LogFn;
}): string {
  const exists = options.exists ?? existsSync;
  const readFile = options.readFile ?? readFileSync;
  const log = options.log ?? console.log;
  const pluginPackageJsonPath = findPluginPackageJsonPath(options.moduleDir, exists);
  const pluginRoot = pluginPackageJsonPath ? dirname(pluginPackageJsonPath) : options.moduleDir;
  const candidates = [
    ["skill package bin", resolveSkillBinPath(options.resolveModule, readFile)],
    ["plugin node_modules .bin", join(pluginRoot, "node_modules", ".bin", "tlon")],
    [
      "plugin skill bin",
      join(pluginRoot, "node_modules", "@tloncorp", "tlon-skill", "bin", "tlon.js"),
    ],
  ] as const;

  for (const [label, candidate] of candidates) {
    if (!candidate) {
      continue;
    }

    log(`[tlon] Checking for ${label} at: ${candidate}, exists: ${exists(candidate)}`);
    if (exists(candidate)) {
      return candidate;
    }
  }

  log("[tlon] Falling back to PATH lookup for 'tlon'");
  return "tlon";
}

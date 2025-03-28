#!/usr/bin/env node
/**
 * This script creates a flat structure of essential dependencies for electron-builder
 */
const fs = require('fs');
const path = require('path');

const appDir = __dirname;
const rootDir = path.resolve(__dirname, '../..');
const appNodeModulesDir = path.join(appDir, 'node_modules');

console.log('Flattening dependencies for electron-builder...');

function copyDirRecursive(source, target) {
  if (!fs.existsSync(target)) {
    fs.mkdirSync(target, { recursive: true });
  }

  fs.readdirSync(source).forEach((file) => {
    const sourcePath = path.join(source, file);
    const targetPath = path.join(target, file);

    if (fs.statSync(sourcePath).isDirectory()) {
      copyDirRecursive(sourcePath, targetPath);
    } else {
      fs.copyFileSync(sourcePath, targetPath);
    }
  });
}

function resolveModulePath(basePath, moduleName) {
  try {
    const modulePath = path.join(basePath, 'node_modules', moduleName);

    if (!fs.existsSync(modulePath)) {
      return null;
    }

    const stats = fs.lstatSync(modulePath);
    if (stats.isSymbolicLink()) {
      const linkTarget = fs.readlinkSync(modulePath);
      const resolvedPath = path.resolve(path.dirname(modulePath), linkTarget);
      return resolvedPath;
    }

    return modulePath;
  } catch (err) {
    return null;
  }
}

function scanNodeModules(baseDir, dependencies = new Set()) {
  const nodeModulesDir = path.join(baseDir, 'node_modules');

  if (!fs.existsSync(nodeModulesDir)) {
    return dependencies;
  }

  try {
    fs.readdirSync(nodeModulesDir)
      .filter((item) => !item.startsWith('.') && item !== '.pnpm')
      .forEach((item) => {
        // Skip scoped packages directory itself but scan within it
        if (item.startsWith('@')) {
          try {
            const scopeDir = path.join(nodeModulesDir, item);
            fs.readdirSync(scopeDir).forEach((scopedPkg) => {
              const fullName = `${item}/${scopedPkg}`;
              dependencies.add(fullName);

              // Also scan node_modules within this scoped package
              scanNodeModules(path.join(scopeDir, scopedPkg), dependencies);
            });
          } catch (err) {
            console.warn(
              `Error scanning scoped package directory ${item}:`,
              err
            );
          }
        } else {
          dependencies.add(item);

          // Also scan node_modules within this package
          scanNodeModules(path.join(nodeModulesDir, item), dependencies);
        }
      });
  } catch (err) {
    console.warn(`Error scanning node_modules at ${baseDir}:`, err);
  }

  return dependencies;
}

// Scan for all dependencies starting from the project root
const allDependencies = scanNodeModules(rootDir);
console.log(`Found ${allDependencies.size} total dependencies in the monorepo`);

// Get direct dependencies from app's package.json
const appPkgJson = JSON.parse(
  fs.readFileSync(path.join(appDir, 'package.json'), 'utf8')
);
const directDeps = new Set(Object.keys(appPkgJson.dependencies || {}));
const devDeps = new Set(Object.keys(appPkgJson.devDependencies || {}));

const requiredDependencies = new Set();

// Recursively add all dependencies of a package
function addTransitiveDeps(packageName, visited = new Set()) {
  if (visited.has(packageName)) return;
  visited.add(packageName);

  const pkgPath = resolveModulePath(rootDir, packageName);
  if (!pkgPath) return;

  const pkgJsonPath = path.join(pkgPath, 'package.json');
  if (!fs.existsSync(pkgJsonPath)) return;

  try {
    const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));
    const deps = pkg.dependencies || {};

    for (const dep of Object.keys(deps)) {
      requiredDependencies.add(dep);
      addTransitiveDeps(dep, visited);
    }
  } catch (err) {
    console.warn(`Error processing dependencies for ${packageName}:`, err);
  }
}

directDeps.forEach((dep) => requiredDependencies.add(dep));
directDeps.forEach((dep) => addTransitiveDeps(dep));
devDeps.forEach((dep) => requiredDependencies.add(dep));
devDeps.forEach((dep) => addTransitiveDeps(dep));

// Explicitly add some dependencies needed by ajv (I'm not sure why these aren't picked up automatically)
const explicitlyNeeded = ['require-from-string', 'fast-uri'];

explicitlyNeeded.forEach((dep) => requiredDependencies.add(dep));

console.log(
  `Found ${requiredDependencies.size} required dependencies to process`
);

console.log('Copying dependencies to app node_modules...');
allDependencies.forEach((depName) => {
  if (!requiredDependencies.has(depName)) {
    return;
  }

  const sourceDir = resolveModulePath(rootDir, depName);
  if (sourceDir) {
    const targetDir = path.join(appNodeModulesDir, depName);
    console.log(`Copying ${depName} to app node_modules`);
    if (fs.existsSync(targetDir)) {
      fs.rmSync(targetDir, { recursive: true, force: true });
    }
    fs.mkdirSync(targetDir, { recursive: true });
    copyDirRecursive(sourceDir, targetDir);
  } else {
    console.warn(`Could not resolve path for ${depName}, skipping`);
  }
});

console.log('Dependency flattening completed successfully');

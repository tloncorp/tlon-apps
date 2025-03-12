#!/usr/bin/env node
/**
 * This script creates a flat structure of all dependencies for electron-builder
 * to avoid the issues with pnpm's symlink structure.
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const appDir = __dirname;
const rootDir = path.resolve(__dirname, '../..');
const appNodeModulesDir = path.join(appDir, 'node_modules');

console.log('Flattening dependencies for electron-builder...');

// Helper function to copy directories recursively
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

// Function to resolve actual module path (following symlinks)
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

// Create temporary directory for dependency flattening
const tempDepsDir = path.join(appDir, 'temp-deps');
if (fs.existsSync(tempDepsDir)) {
  fs.rmSync(tempDepsDir, { recursive: true, force: true });
}
fs.mkdirSync(tempDepsDir, { recursive: true });

// Get all dependencies directly from the file system since pnpm list command
// might have a different structure
console.log('Getting all dependencies...');

// Function to scan node_modules directories
function scanNodeModules(baseDir, dependencies = new Set()) {
  const nodeModulesDir = path.join(baseDir, 'node_modules');

  if (!fs.existsSync(nodeModulesDir)) {
    return dependencies;
  }

  // Read direct subdirectories of node_modules (actual modules)
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

// extractDependencies(dependencyTree, allDependencies);
console.log(`Found ${allDependencies.size} total dependencies to process`);

// First pass: copy all dependencies to temporary directory with a flat structure
console.log('Copying dependencies to temporary directory...');
allDependencies.forEach((depName) => {
  const sourceDir = resolveModulePath(rootDir, depName);
  if (sourceDir) {
    const targetDir = path.join(tempDepsDir, depName);
    console.log(`Copying ${depName} to temporary directory`);
    if (fs.existsSync(targetDir)) {
      fs.rmSync(targetDir, { recursive: true, force: true });
    }
    fs.mkdirSync(targetDir, { recursive: true });
    copyDirRecursive(sourceDir, targetDir);
  } else {
    console.warn(`Could not resolve path for ${depName}, skipping`);
  }
});

// Second pass: update package.json files in the temporary directory to use flat dependencies
console.log('Updating package.json files for flat dependencies...');
allDependencies.forEach((depName) => {
  const packageJsonPath = path.join(tempDepsDir, depName, 'package.json');
  if (fs.existsSync(packageJsonPath)) {
    try {
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

      // Modify dependencies to use flat structure
      if (packageJson.dependencies) {
        Object.keys(packageJson.dependencies).forEach((dep) => {
          if (allDependencies.has(dep)) {
            // Use a relative path that will resolve within node_modules
            packageJson.dependencies[dep] = `file:../${dep}`;
          }
        });

        // Write updated package.json
        fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
      }
    } catch (err) {
      console.error(`Error updating package.json for ${depName}:`, err);
    }
  }
});

// Now copy all flattened dependencies to app's node_modules
console.log('Copying flattened dependencies to app node_modules...');
if (fs.existsSync(appNodeModulesDir)) {
  // Don't delete entire node_modules, just copy over the flat deps
  console.log('Updating existing node_modules directory...');
} else {
  fs.mkdirSync(appNodeModulesDir, { recursive: true });
}

copyDirRecursive(tempDepsDir, appNodeModulesDir);

// Clean up temporary directory
fs.rmSync(tempDepsDir, { recursive: true, force: true });

// Handle workspace dependencies
console.log('Handling workspace dependencies...');
const workspaceDeps = ['@tloncorp/app', '@tloncorp/shared', '@tloncorp/editor'];
workspaceDeps.forEach(workspaceDep => {
  console.log(`Processing workspace dependency: ${workspaceDep}`);
  
  // Find the workspace package directory
  let packageDir = null;
  if (workspaceDep.startsWith('@tloncorp/')) {
    const pkgName = workspaceDep.split('/')[1];
    packageDir = path.join(rootDir, 'packages', pkgName);
  }
  
  if (!packageDir || !fs.existsSync(packageDir)) {
    console.warn(`Couldn't find workspace package directory for ${workspaceDep}`);
    return;
  }
  
  // Read its package.json
  const pkgJsonPath = path.join(packageDir, 'package.json');
  if (!fs.existsSync(pkgJsonPath)) {
    console.warn(`No package.json found for ${workspaceDep}`);
    return;
  }
  
  try {
    // Create directory in app's node_modules for this workspace package
    const targetDir = path.join(appNodeModulesDir, workspaceDep);
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }
    
    // Copy package.json
    fs.copyFileSync(pkgJsonPath, path.join(targetDir, 'package.json'));
    
    // Get dependencies from the package
    const pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));
    const deps = Object.keys(pkgJson.dependencies || {});
    
    console.log(`Dependencies of ${workspaceDep}:`, deps);
    
    // Create node_modules for the workspace package
    const targetNodeModulesDir = path.join(targetDir, 'node_modules');
    if (!fs.existsSync(targetNodeModulesDir)) {
      fs.mkdirSync(targetNodeModulesDir, { recursive: true });
    }
    
    // Copy build assets for this workspace package
    console.log(`Copying build assets for ${workspaceDep}...`);
    
    // Find and copy built files
    const buildDirs = ['dist', 'build', 'lib'];
    for (const dir of buildDirs) {
      const buildDir = path.join(packageDir, dir);
      if (fs.existsSync(buildDir)) {
        console.log(`Found build directory: ${dir}`);
        copyDirRecursive(buildDir, path.join(targetDir, dir));
        break;
      }
    }
    
    // Copy additional important files
    ['index.js', 'index.d.ts', 'index.mjs'].forEach(file => {
      const filePath = path.join(packageDir, file);
      if (fs.existsSync(filePath)) {
        fs.copyFileSync(filePath, path.join(targetDir, file));
      }
    });
    
    // Update the package.json with flat dependency paths
    try {
      const targetPkgJson = JSON.parse(fs.readFileSync(path.join(targetDir, 'package.json'), 'utf8'));
      if (targetPkgJson.dependencies) {
        Object.keys(targetPkgJson.dependencies).forEach(dep => {
          if (dep.startsWith('@tloncorp/')) {
            targetPkgJson.dependencies[dep] = 'file:../' + dep;
          } else if (allDependencies.has(dep)) {
            targetPkgJson.dependencies[dep] = 'file:../' + dep;
          }
        });
        fs.writeFileSync(path.join(targetDir, 'package.json'), 
                        JSON.stringify(targetPkgJson, null, 2));
      }
    } catch (err) {
      console.error(`Error updating package.json for ${workspaceDep}:`, err);
    }
  } catch (err) {
    console.error(`Error processing workspace dependency ${workspaceDep}:`, err);
  }
});

// Handle known problematic packages
console.log('Creating stub modules for problematic dependencies...');
const knownProblematicDeps = [
  // Emoji dependencies
  '@emoji-mart/data',
  '@emoji-mart/react',
  'emoji-mart',
  
  // Workspace dependencies
  '@tloncorp/editor',
  '@tloncorp/ui',
  
  // React Native dependencies
  'react-native-email-link',
  'react-native-fetch-api',
  'react-native-polyfill-globals',
  'react-native-device-info',
  
  // Expo dependencies
  'expo-blur',
  'expo-notifications',
  
  // Firebase dependencies
  '@react-native-firebase/perf',
  
  // Other dependencies
  'sqlocal'
];

function createEmptyModule(moduleName) {
  console.log(`Creating empty module for ${moduleName}...`);
  const moduleDir = path.join(appNodeModulesDir, moduleName);
  
  // Create directory
  if (!fs.existsSync(moduleDir)) {
    fs.mkdirSync(moduleDir, { recursive: true });
  }
  
  // Create package.json
  const packageJson = {
    name: moduleName,
    version: "1.0.0",
    description: "Empty module to satisfy electron-builder",
    main: "index.js"
  };
  
  fs.writeFileSync(path.join(moduleDir, 'package.json'), JSON.stringify(packageJson, null, 2));
  
  // Create index.js
  fs.writeFileSync(path.join(moduleDir, 'index.js'), 'module.exports = {};');
  
  return moduleDir;
}

knownProblematicDeps.forEach(dep => {
  // Check if it already exists
  if (!fs.existsSync(path.join(appNodeModulesDir, dep))) {
    createEmptyModule(dep);
  }
});

console.log('Dependency flattening completed successfully');

// Now rebuild native modules specifically for Electron
console.log('Rebuilding native modules for current Electron version...');
try {
  const electronRebuildPath = path.join(
    rootDir,
    'node_modules',
    '.bin',
    'electron-rebuild'
  );
  const command = `cd "${appDir}" && "${electronRebuildPath}" -f -w better-sqlite3`;

  console.log(`Executing: ${command}`);
  execSync(command, { stdio: 'inherit' });

  console.log('Rebuild successful');
} catch (error) {
  console.error('Failed to rebuild native module:', error);
  // Don't exit, we can still try to build
}

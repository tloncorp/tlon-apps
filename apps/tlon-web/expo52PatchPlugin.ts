import type { Plugin } from 'vite';

/**
 * Vite plugin to fix Expo 52 compatibility issues.
 *
 * This is a temporary workaround for Expo 52 modules that try to assign to the
 * read-only 'name' property of function classes, causing "Cannot assign to read only property" errors.
 *
 * TODO: Remove this plugin once Expo fixes these issues upstream.
 * Related issues: Classes extending NativeModule in expo-image and other Expo modules
 * have `static name = 'ModuleName'` which fails in strict mode after transpilation.
 */
export default function expo52PatchPlugin(): Plugin {
  return {
    name: 'expo52-patch',
    enforce: 'pre', // Run early to catch the source before other transformations

    transform(code: string, id: string) {
      // Only process files from expo packages that are likely to have the issue
      if (
        !id.includes('node_modules/expo-image') &&
        !id.includes('node_modules/expo-modules-core')
      ) {
        return null;
      }

      let transformedCode = code;
      let hasChanges = false;

      try {
        // Pattern 1: Remove static name = 'SomeName' from source TypeScript/JavaScript
        // This specifically targets the problematic pattern in Expo modules
        if (
          code.includes('static name =') &&
          code.includes('extends NativeModule')
        ) {
          transformedCode = transformedCode.replace(
            /static\s+name\s*=\s*['"][^'"]*['"]\s*;?/g,
            '/* static name removed by expo52-patch */'
          );
          hasChanges = true;
        }

        // Pattern 2: Also check for patterns like "this.name = " in static blocks
        // This catches transpiled versions of the static property
        if (
          code.includes('static') &&
          code.includes('this.name') &&
          code.includes('Module')
        ) {
          transformedCode = transformedCode.replace(
            /static\s*{\s*[^}]*this\.name\s*=[^}]*}/g,
            'static { /* name assignment removed */ }'
          );
          hasChanges = true;
        }
      } catch (error) {
        console.error(`[expo52-patch] Error processing ${id}:`, error);
        return null;
      }

      if (hasChanges) {
        return {
          code: transformedCode,
          map: null, // TODO: Generate proper source maps for better debugging
        };
      }

      return null;
    },

    // Also process the final chunks to catch any patterns that were generated during transpilation
    renderChunk(code: string, chunk) {
      // Only process JavaScript chunks
      if (!chunk.fileName.endsWith('.js')) {
        return null;
      }

      let patchedCode = code;
      let hasChanges = false;

      try {
        // Remove the helper function calls like wa(this,"ModuleName")
        // This is what esbuild generates for static name assignments
        const helperMatches = patchedCode.match(
          /\bstatic\s*{\s*\w+\(this,\s*["'][^'"]*Module["']\)\s*}/g
        );
        if (helperMatches) {
          helperMatches.forEach((match) => {
            // Replace the helper call with an empty statement
            const patched = match.replace(
              /\w+\(this,\s*["'][^'"]*["']\)/g,
              '0'
            );
            patchedCode = patchedCode.replace(match, patched);
          });
          hasChanges = true;
        }
      } catch (error) {
        console.error(
          `[expo52-patch] Error processing chunk ${chunk.fileName}:`,
          error
        );
        return null;
      }

      if (hasChanges) {
        return {
          code: patchedCode,
          map: null, // TODO: Generate proper source maps
        };
      }

      return null;
    },
  };
}

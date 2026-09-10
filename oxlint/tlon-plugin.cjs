// Custom lint rules for the tlon-apps monorepo, ported from the ESLint
// `no-restricted-syntax` / `import-x/no-restricted-paths` config so they keep
// working under oxlint (which has no native `no-restricted-syntax` /
// `no-restricted-paths`). Loaded via oxlint's `jsPlugins`.
const path = require('path');

const STACK_COMPONENTS = /^(Stack|XStack|YStack|View|ListItem)$/;
const TOP_TAB_ROUTES = /^(ChatList|Activity|Contacts|Settings)$/;
const NAVIGATE_MESSAGE =
  "navigate() to a top-level tab route must pass { pop: true } as the third argument. React Navigation 7's navigate() pushes a new screen by default — without pop:true this causes duplicate screen mounts and perceived input delay on Android. See TLON-5598.";

// A route literal may be wrapped in a TypeScript-only expression, e.g.
// `navigate('ChatList' as never)` or `navigate('ChatList' satisfies TopTab)`.
// All of these erase at runtime, so unwrap to the literal underneath.
const TS_EXPRESSION_WRAPPERS = new Set([
  'TSAsExpression',
  'TSSatisfiesExpression',
  'TSNonNullExpression',
  'TSTypeAssertion',
  'TSInstantiationExpression',
]);

function literalValue(node) {
  if (!node) return undefined;
  if (node.type === 'Literal') return node.value;
  if (TS_EXPRESSION_WRAPPERS.has(node.type)) {
    return literalValue(node.expression);
  }
  return undefined;
}

function hasPopTrue(arg) {
  if (!arg || arg.type !== 'ObjectExpression') return false;
  return arg.properties.some((p) => {
    if (p.type !== 'Property') return false;
    const key =
      (p.key.type === 'Identifier' && p.key.name) ||
      (p.key.type === 'Literal' && p.key.value);
    return (
      key === 'pop' && p.value.type === 'Literal' && p.value.value === true
    );
  });
}

function checkNavigate(context, node) {
  const value = literalValue(node.arguments[0]);
  if (typeof value !== 'string' || !TOP_TAB_ROUTES.test(value)) return;
  if (hasPopTrue(node.arguments[2])) return;
  context.report({ node, message: NAVIGATE_MESSAGE });
}

// zones: files under `target` may not import from `from` (both dir prefixes,
// repo-relative). Mirrors importBoundaries() in the old ESLint config.
const RESTRICTED_ZONES = [
  ['packages/api/src/lib', 'packages/api/src/http-api'],
  ['packages/api/src/lib', 'packages/api/src/urbit'],
  ['packages/api/src/lib', 'packages/api/src/client'],
  ['packages/api/src/http-api', 'packages/api/src/urbit'],
  ['packages/api/src/http-api', 'packages/api/src/client'],
  ['packages/api/src/urbit', 'packages/api/src/client'],
  ['packages/shared/src/utils', 'packages/shared/src/logic'],
  ['packages/shared/src/utils', 'packages/shared/src/db'],
  ['packages/shared/src/utils', 'packages/shared/src/store'],
  ['packages/shared/src/logic', 'packages/shared/src/db'],
  ['packages/shared/src/logic', 'packages/shared/src/store'],
  ['packages/shared/src/db', 'packages/shared/src/store'],
];

// Maps a workspace package self-reference (`@tloncorp/api/lib/foo`) onto the
// source path the zone list is written against. Bare specifiers otherwise skip
// the check, which would let an alias cross a forbidden boundary.
// Subpaths whose package `exports` entry does not map straight to `src/<sub>`.
// `@tloncorp/api` keeps `./api/*` as a compatibility alias for `./src/client/*`.
const ALIAS_SUBPATH_OVERRIDES = {
  api: [[/^api\//, 'client/']],
};

function aliasToSourcePath(source) {
  const match = /^@tloncorp\/([^/]+)\/(.+)$/.exec(source);
  if (!match) {
    return undefined;
  }
  const [, pkg, subpath] = match;
  let resolved = subpath;
  for (const [pattern, replacement] of ALIAS_SUBPATH_OVERRIDES[pkg] ?? []) {
    if (pattern.test(resolved)) {
      resolved = resolved.replace(pattern, replacement);
      break;
    }
  }
  return `packages/${pkg}/src/${resolved}`;
}

function toPosix(p) {
  return p.split(path.sep).join('/');
}

// `import('x')` may carry a no-substitution template literal, which has no
// `.value`; read the single quasi so that form is checked too.
function specifierOf(node) {
  const src = node.source;
  if (!src) {
    return undefined;
  }
  if (typeof src.value === 'string') {
    return src.value;
  }
  if (src.type === 'TemplateLiteral' && src.expressions.length === 0) {
    const quasi = src.quasis[0];
    return quasi && (quasi.value.cooked ?? quasi.value.raw);
  }
  return undefined;
}

function checkRestrictedPath(context, node, reportNode = node) {
  const source = specifierOf(node);
  if (typeof source !== 'string') {
    return;
  }
  const filename = context.filename || context.physicalFilename;
  if (!filename) {
    return;
  }
  // Anchor to the repo root, not the invocation directory: `pnpm -r lint` runs
  // oxlint from inside each package, so a cwd-relative path would never match
  // the repo-relative zone prefixes below.
  const repoRoot = path.resolve(__dirname, '..');
  const fileRel = toPosix(path.relative(repoRoot, filename));

  let importedRel;
  if (source.startsWith('.')) {
    importedRel = toPosix(
      path.relative(repoRoot, path.resolve(path.dirname(filename), source))
    );
  } else {
    importedRel = aliasToSourcePath(source);
  }
  if (!importedRel) {
    return;
  }

  for (const [target, from] of RESTRICTED_ZONES) {
    if (
      (fileRel === target || fileRel.startsWith(target + '/')) &&
      (importedRel === from || importedRel.startsWith(from + '/'))
    ) {
      context.report({
        node: reportNode,
        message: `Import boundary: files in ${target} may not import from ${from}.`,
      });
      return;
    }
  }
}

module.exports = {
  meta: { name: 'tlon' },
  rules: {
    'no-get-token': {
      create(context) {
        return {
          CallExpression(node) {
            if (
              node.callee.type === 'Identifier' &&
              node.callee.name === 'getToken'
            ) {
              context.report({
                node,
                message:
                  'Please use getTokenValue() instead of getToken() to ensure web compatibility. See: https://tamagui.dev/docs/core/exports#gettokenvalue',
              });
            }
          },
        };
      },
    },
    'no-stack-press': {
      create(context) {
        return {
          JSXOpeningElement(node) {
            if (
              node.name.type !== 'JSXIdentifier' ||
              !STACK_COMPONENTS.test(node.name.name)
            ) {
              return;
            }
            for (const attr of node.attributes) {
              if (
                attr.type === 'JSXAttribute' &&
                attr.name.type === 'JSXIdentifier' &&
                (attr.name.name === 'onPress' ||
                  attr.name.name === 'onLongPress')
              ) {
                context.report({
                  node: attr,
                  message: `Do not use ${attr.name.name} on Stack, View or ListItem components. Use Pressable instead.`,
                });
              }
            }
          },
        };
      },
    },
    'no-common-actions-reset': {
      create(context) {
        return {
          MemberExpression(node) {
            if (
              node.object.type === 'Identifier' &&
              node.object.name === 'CommonActions' &&
              node.property.type === 'Identifier' &&
              node.property.name === 'reset'
            ) {
              context.report({
                node,
                message:
                  'Please use the useTypedReset() hook instead of CommonActions.reset() for type safety.',
              });
            }
          },
          ImportDeclaration(node) {
            if (node.source.value !== '@react-navigation/native') return;
            for (const spec of node.specifiers) {
              if (
                spec.type === 'ImportSpecifier' &&
                spec.imported.type === 'Identifier' &&
                spec.imported.name === 'reset'
              ) {
                context.report({
                  node: spec,
                  message:
                    'Please use the useTypedReset() hook instead of importing reset from @react-navigation/native for type safety.',
                });
              }
            }
          },
        };
      },
    },
    'navigate-requires-pop': {
      create(context) {
        return {
          CallExpression(node) {
            const callee = node.callee;
            const isNavigate =
              (callee.type === 'MemberExpression' &&
                callee.property.type === 'Identifier' &&
                callee.property.name === 'navigate') ||
              (callee.type === 'Identifier' && callee.name === 'navigate');
            if (isNavigate) checkNavigate(context, node);
          },
        };
      },
    },
    'restricted-paths': {
      create(context) {
        // `export ... from` / `export * from` create the same dependency as an
        // import, so all three declaration types are checked.
        const check = (node) => checkRestrictedPath(context, node);
        return {
          ImportDeclaration: check,
          ExportNamedDeclaration: check,
          ExportAllDeclaration: check,
          // `await import('../client/x')` creates the same dependency lazily.
          ImportExpression: check,
          // `require('../client/x')` does too, and no-var-requires is off here.
          CallExpression(node) {
            if (
              node.callee.type === 'Identifier' &&
              node.callee.name === 'require' &&
              node.arguments.length === 1
            ) {
              checkRestrictedPath(context, { source: node.arguments[0] }, node);
            }
          },
        };
      },
    },
  },
};

// Custom lint rules for the tlon-apps monorepo, ported from the ESLint
// `no-restricted-syntax` / `import-x/no-restricted-paths` config so they keep
// working under oxlint (which has no native `no-restricted-syntax` /
// `no-restricted-paths`). Loaded via oxlint's `jsPlugins`.
const path = require('path');

const STACK_COMPONENTS = /^(Stack|XStack|YStack|View|ListItem)$/;
// Bot / Workspaces (ChatList) / Settings are the mobile tabs; Activity and
// Contacts are drawer destinations on desktop and repeat targets on mobile,
// where a pop-less navigate mounts a duplicate just the same.
const TOP_TAB_ROUTES = /^(BotChat|ChatList|Activity|Contacts|Settings)$/;
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
const BOUNDARY_ZONES = [
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

// The desk request registry covers app code only (desk-request-scope.json).
// Bot-facing modules listed there keep their raw requests and must stay
// unreachable from app code, directly or through packages/openclaw.
const DESK_REQUEST_SCOPE = require('./desk-request-scope.json');
// The app roots plus every workspace package they consume: code in any of
// them ends up in the app, so none may reach a raw request or a bot module.
const APP_ROOTS = [
  ...DESK_REQUEST_SCOPE.appRoots,
  ...DESK_REQUEST_SCOPE.consumedPackages,
];
const EXCLUDED_MODULES = DESK_REQUEST_SCOPE.excludedModules;

const RESTRICTED_ZONES = [
  ...BOUNDARY_ZONES,
  ...APP_ROOTS.flatMap((root) => [
    ...EXCLUDED_MODULES.map((module) => [root, module]),
    [root, 'packages/openclaw'],
  ]),
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
  let src = node.source;
  // `require('x' as const)` and `import(('x'))` name the same module.
  while (
    src &&
    (TS_EXPRESSION_WRAPPERS.has(src.type) ||
      src.type === 'ParenthesizedExpression')
  ) {
    src = src.expression;
  }
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

const REPO_ROOT = path.resolve(__dirname, '..');

// Extension and `/index` are dropped so that `./x`, `./x.js`, `./x.ts` and
// `./x/index` name the same module the zones and wrapper list are written in.
function normalizeModule(rel) {
  return rel.replace(/\.(?:[cm]?[jt]sx?)$/, '').replace(/\/index$/, '');
}

// Anchor to the repo root, not the invocation directory: `pnpm -r lint` runs
// oxlint from inside each package, so a cwd-relative path would never match
// the repo-relative prefixes below.
function repoRelative(filename) {
  return toPosix(path.relative(REPO_ROOT, filename));
}

function isUnder(rel, prefix) {
  return rel === prefix || rel.startsWith(prefix + '/');
}

// Resolves an import specifier to the repo-relative source module it names:
// relative paths, `@tloncorp/<pkg>` (bare and subpaths) and the web app's
// `@/` alias. Anything else (third-party packages) is undefined.
function resolveSpecifier(filename, source) {
  let rel;
  if (source.startsWith('.')) {
    rel = repoRelative(path.resolve(path.dirname(filename), source));
  } else if (/^@tloncorp\/[^/]+$/.test(source)) {
    rel = `packages/${source.slice('@tloncorp/'.length)}/src/index`;
  } else if (source.startsWith('@/')) {
    if (!isUnder(repoRelative(filename), 'apps/tlon-web')) {
      return undefined;
    }
    rel = `apps/tlon-web/src/${source.slice(2)}`;
  } else {
    rel = aliasToSourcePath(source);
  }
  return rel === undefined ? undefined : normalizeModule(rel);
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
  const fileRel = repoRelative(filename);
  const importedRel = resolveSpecifier(filename, source);
  if (!importedRel) {
    return;
  }

  for (const [target, from] of RESTRICTED_ZONES) {
    if (isUnder(fileRel, target) && isUnder(importedRel, from)) {
      context.report({
        node: reportNode,
        message: `Import boundary: files in ${target} may not import from ${from}.`,
      });
      return;
    }
  }
}

// --- tlon/no-raw-desk-request ----------------------------------------------

// Modules that hand out raw request functions or a raw client. Everything
// under http-api is included for the `Urbit` class and its default export.
const WRAPPER_MODULES = new Set([
  'packages/api/src',
  'packages/api/src/client',
  'packages/api/src/client/urbit',
  'apps/tlon-web/src/api',
]);
const WRAPPER_TREES = ['packages/api/src/http-api'];
const WEB_API_MODULE = 'apps/tlon-web/src/api';

// Request functions, the raw client proxy and the client class.
const RAW_NAMES = new Set([
  'scry',
  'scryNoun',
  'poke',
  'pokeNoun',
  'trackedPoke',
  'trackedPokeNoun',
  'subscribe',
  'subscribeOnce',
  'thread',
  'requestJson',
  'request',
  'client',
  'Urbit',
]);
// A namespace object also reaches a module's default export.
const RAW_MEMBERS = new Set([...RAW_NAMES, 'default']);

const RAW_REQUEST_MESSAGE =
  'Desk requests go through a registry entry (packages/api/src/client/requests) and its helper, not a raw wrapper or client.';

function isWrapperModule(rel) {
  return WRAPPER_MODULES.has(rel) || WRAPPER_TREES.some((t) => isUnder(rel, t));
}

function isTestFile(rel) {
  return (
    /\.test\.[jt]sx?$/.test(rel) ||
    rel.split('/').some((seg) => seg === '__tests__' || seg === 'test')
  );
}

function isRequestRuleExempt(fileRel) {
  const moduleRel = normalizeModule(fileRel);
  return (
    !APP_ROOTS.some((root) => isUnder(fileRel, root)) ||
    isWrapperModule(moduleRel) ||
    isUnder(moduleRel, 'packages/api/src/client/requests') ||
    EXCLUDED_MODULES.some((m) => isUnder(moduleRel, m)) ||
    isTestFile(fileRel)
  );
}

const TS_VALUE_WRAPPERS = new Set([
  'TSAsExpression',
  'TSSatisfiesExpression',
  'TSNonNullExpression',
  'TSTypeAssertion',
  'TSInstantiationExpression',
]);
const TS_VALUE_CONTAINERS = new Set([
  'TSExportAssignment',
  'TSEnumDeclaration',
  'TSEnumBody',
  'TSEnumMember',
  'TSModuleDeclaration',
  'TSModuleBlock',
]);

// True when the identifier sits in a type (`Urbit['on']`, `typeof scry`).
function inTypePosition(identifier) {
  let child = identifier;
  for (let node = identifier.parent; node; node = node.parent) {
    if (node.type.startsWith('TS') && !TS_VALUE_CONTAINERS.has(node.type)) {
      if (!TS_VALUE_WRAPPERS.has(node.type) || node.expression !== child) {
        return true;
      }
    }
    child = node;
  }
  return false;
}

function memberName(member) {
  if (!member.computed) {
    return member.property.type === 'Identifier'
      ? member.property.name
      : undefined;
  }
  const value = literalValue(member.property);
  if (typeof value === 'string') {
    return value;
  }
  const prop = member.property;
  if (prop.type === 'TemplateLiteral' && prop.expressions.length === 0) {
    return prop.quasis[0].value.cooked ?? prop.quasis[0].value.raw;
  }
  return undefined;
}

// A reference to an object that carries raw members (a namespace, the web
// api instance) is fine only as the object of a member access to something
// else. Forwarding the object, destructuring it, or indexing it with a key we
// cannot read could reach a raw member.
function checkObjectReference(context, identifier, members) {
  const parent = identifier.parent;
  if (parent.type === 'MemberExpression' && parent.object === identifier) {
    const name = memberName(parent);
    if (name === undefined || members.has(name)) {
      context.report({ node: parent, message: RAW_REQUEST_MESSAGE });
    }
    return;
  }
  context.report({ node: identifier, message: RAW_REQUEST_MESSAGE });
}

function checkBinding(context, specifier, moduleRel) {
  // Members of the binding that are raw; undefined when any value use of
  // the binding is.
  let members;
  if (specifier.type === 'ImportNamespaceSpecifier') {
    members = RAW_MEMBERS;
  } else {
    const imported =
      specifier.type === 'ImportDefaultSpecifier'
        ? 'default'
        : (specifier.imported.name ?? specifier.imported.value);
    if (imported === 'default') {
      // The web api default is an object with raw methods; any other
      // wrapper's default is the client class itself.
      members = moduleRel === WEB_API_MODULE ? RAW_NAMES : undefined;
    } else if (!RAW_NAMES.has(imported)) {
      return;
    }
  }
  const variables =
    context.sourceCode.scopeManager.getDeclaredVariables(specifier);
  for (const variable of variables) {
    for (const reference of variable.references) {
      const identifier = reference.identifier;
      if (inTypePosition(identifier)) {
        continue;
      }
      if (members) {
        checkObjectReference(context, identifier, members);
      } else {
        context.report({ node: identifier, message: RAW_REQUEST_MESSAGE });
      }
    }
  }
}

function isTypeOnly(node) {
  return node.importKind === 'type' || node.exportKind === 'type';
}

function createNoRawDeskRequest(context) {
  const filename = context.filename || context.physicalFilename;
  if (!filename || isRequestRuleExempt(repoRelative(filename))) {
    return {};
  }
  const wrapperOf = (source) => {
    if (typeof source !== 'string') {
      return undefined;
    }
    const rel = resolveSpecifier(filename, source);
    return rel !== undefined && isWrapperModule(rel) ? rel : undefined;
  };
  const report = (node) =>
    context.report({ node, message: RAW_REQUEST_MESSAGE });

  return {
    ImportDeclaration(node) {
      const moduleRel = wrapperOf(node.source.value);
      if (!moduleRel || isTypeOnly(node)) {
        return;
      }
      for (const specifier of node.specifiers) {
        if (!isTypeOnly(specifier)) {
          checkBinding(context, specifier, moduleRel);
        }
      }
    },
    ExportAllDeclaration(node) {
      if (wrapperOf(node.source.value) && !isTypeOnly(node)) {
        report(node);
      }
    },
    ExportNamedDeclaration(node) {
      if (!node.source || isTypeOnly(node)) {
        return;
      }
      const moduleRel = wrapperOf(node.source.value);
      if (!moduleRel) {
        return;
      }
      for (const specifier of node.specifiers) {
        const name = specifier.local.name ?? specifier.local.value;
        if (!isTypeOnly(specifier) && RAW_MEMBERS.has(name)) {
          report(specifier);
        }
      }
    },
    ImportExpression(node) {
      const source = specifierOf(node);
      // A computed specifier could name a wrapper too.
      if (source === undefined || wrapperOf(source)) {
        report(node);
      }
    },
    CallExpression(node) {
      if (
        node.callee.type !== 'Identifier' ||
        node.callee.name !== 'require' ||
        node.arguments.length !== 1
      ) {
        return;
      }
      const source = specifierOf({ source: node.arguments[0] });
      // As with import(): a target we cannot read could be a wrapper.
      if (source === undefined || wrapperOf(source)) {
        report(node);
      }
    },
  };
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
    'no-raw-desk-request': {
      create: createNoRawDeskRequest,
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

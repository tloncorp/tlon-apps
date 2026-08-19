// Custom lint rules for the tlon-apps monorepo, ported from the ESLint
// `no-restricted-syntax` / `import-x/no-restricted-paths` config so they keep
// working under oxlint (which has no native `no-restricted-syntax` /
// `no-restricted-paths`). Loaded via oxlint's `jsPlugins`.
const path = require('path');

const STACK_COMPONENTS = /^(Stack|XStack|YStack|View|ListItem)$/;
const TOP_TAB_ROUTES = /^(ChatList|Activity|Contacts|Settings)$/;
const NAVIGATE_MESSAGE =
  "navigate() to a top-level tab route must pass { pop: true } as the third argument. React Navigation 7's navigate() pushes a new screen by default — without pop:true this causes duplicate screen mounts and perceived input delay on Android. See TLON-5598.";

function literalValue(node) {
  if (!node) return undefined;
  if (node.type === 'Literal') return node.value;
  // `navigate('ChatList' as never)` wraps the literal in a TSAsExpression.
  if (node.type === 'TSAsExpression') return literalValue(node.expression);
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

function checkRestrictedPath(context, node) {
  const source = node.source && node.source.value;
  if (typeof source !== 'string' || !source.startsWith('.')) return;
  const filename = context.filename || context.physicalFilename;
  if (!filename) return;
  const cwd = context.cwd || process.cwd();
  const fileRel = path.relative(cwd, filename);
  const importedRel = path.relative(
    cwd,
    path.resolve(path.dirname(filename), source)
  );
  for (const [target, from] of RESTRICTED_ZONES) {
    if (
      (fileRel === target || fileRel.startsWith(target + path.sep)) &&
      (importedRel === from || importedRel.startsWith(from + path.sep))
    ) {
      context.report({
        node,
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
        return {
          ImportDeclaration(node) {
            checkRestrictedPath(context, node);
          },
        };
      },
    },
  },
};

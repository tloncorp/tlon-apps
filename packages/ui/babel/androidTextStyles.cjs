// Babel plugin for Android builds: swaps the iOS text values that the Tamagui
// compiler bakes into flattened styles for the Android ones.
//
// The compiler (@tamagui/babel-plugin) loads @tloncorp/ui once per native build
// with react-native swapped for its web build, so it can't tell iOS from
// Android, and it resolves platform choices to iOS (see Text.tsx and
// tamagui.config.ts). Two such values reach the flattened styles it writes to
// the file's `__ReactNativeStyleSheet.create({...})` sheet: text trims
// (marginTop/marginBottom pairs) and font families. This plugin replaces each
// iOS value with the Android value for the same text size or font.
//
// List it after @tamagui/babel-plugin, for Android builds only.
const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, '../src');
const trimSettingsFile = path.join(
  srcDir,
  'components/TextV2/trimSettings.tsx'
);
const trimOverridesFile = path.join(
  srcDir,
  'components/TextV2/trimOverrides.ts'
);
const tamaguiConfigFile = path.join(__dirname, '../tamagui.config.ts');

function literalValue(node, file) {
  switch (node.type) {
    case 'TSAsExpression':
    case 'TSSatisfiesExpression':
      return literalValue(node.expression, file);
    case 'ObjectExpression': {
      const value = {};
      for (const property of node.properties) {
        if (property.type !== 'ObjectProperty' || property.computed) {
          throw new Error(`androidTextStyles: unsupported property in ${file}`);
        }
        const key =
          property.key.type === 'Identifier'
            ? property.key.name
            : property.key.value;
        value[key] = literalValue(property.value, file);
      }
      return value;
    }
    case 'NumericLiteral':
    case 'StringLiteral':
      return node.value;
    case 'UnaryExpression':
      if (node.operator === '-') return -literalValue(node.argument, file);
      break;
  }
  throw new Error(`androidTextStyles: unsupported ${node.type} in ${file}`);
}

/** Reads the named `export const` declarations of a file as plain values. */
function readExportedLiterals(babel, file, names) {
  const ast = babel.parseSync(fs.readFileSync(file, 'utf8'), {
    filename: file,
    babelrc: false,
    configFile: false,
    parserOpts: { plugins: ['typescript'] },
  });
  const exports = {};
  for (const statement of ast.program.body) {
    if (
      statement.type !== 'ExportNamedDeclaration' ||
      statement.declaration?.type !== 'VariableDeclaration'
    ) {
      continue;
    }
    for (const declarator of statement.declaration.declarations) {
      if (names.includes(declarator.id.name)) {
        exports[declarator.id.name] = literalValue(declarator.init, file);
      }
    }
  }
  return exports;
}

function withOverrides(table, overrides) {
  const result = { ...table };
  for (const [size, style] of Object.entries(overrides)) {
    result[size] = { ...result[size], ...style };
  }
  return result;
}

const trimKey = (marginTop, marginBottom) => `${marginTop}|${marginBottom}`;

/**
 * Maps each iOS value to its Android value: `trims` is keyed by the iOS
 * marginTop/marginBottom pair, `fontFamilies` by the iOS family name.
 */
function buildReplacements(babel) {
  const { trimIos, trimAndroid } = readExportedLiterals(
    babel,
    trimSettingsFile,
    ['trimIos', 'trimAndroid']
  );
  const { trimOverrides } = readExportedLiterals(babel, trimOverridesFile, [
    'trimOverrides',
  ]);
  const { fontFamilies } = readExportedLiterals(babel, tamaguiConfigFile, [
    'fontFamilies',
  ]);

  const iosTrims = withOverrides(trimIos, trimOverrides.ios);
  const androidTrims = withOverrides(trimAndroid, trimOverrides.android);
  const trims = new Map();
  for (const [size, iosTrim] of Object.entries(iosTrims)) {
    const androidTrim = androidTrims[size];
    if (!androidTrim) {
      throw new Error(`androidTextStyles: no Android trim for ${size}`);
    }
    const key = trimKey(iosTrim.marginTop, iosTrim.marginBottom);
    const existing = trims.get(key);
    if (
      existing &&
      (existing.marginTop !== androidTrim.marginTop ||
        existing.marginBottom !== androidTrim.marginBottom)
    ) {
      // Two sizes share iOS trims but not Android ones, so a baked style alone
      // can't say which Android trim applies.
      throw new Error(`androidTextStyles: ambiguous iOS trim for ${size}`);
    }
    trims.set(key, androidTrim);
  }

  const families = new Map();
  for (const [font, iosFamily] of Object.entries(fontFamilies.ios)) {
    const androidFamily = fontFamilies.android[font];
    if (androidFamily === iosFamily) continue;
    if (families.has(iosFamily) && families.get(iosFamily) !== androidFamily) {
      throw new Error(`androidTextStyles: ambiguous iOS font ${iosFamily}`);
    }
    families.set(iosFamily, androidFamily);
  }

  return { trims, fontFamilies: families };
}

function numberValue(node) {
  if (!node) return undefined;
  if (node.type === 'NumericLiteral') return node.value;
  if (
    node.type === 'UnaryExpression' &&
    node.operator === '-' &&
    node.argument.type === 'NumericLiteral'
  ) {
    return -node.argument.value;
  }
  return undefined;
}

function propertyName(property) {
  if (property.type !== 'ObjectProperty' || property.computed) return null;
  if (property.key.type === 'Identifier') return property.key.name;
  if (property.key.type === 'StringLiteral') return property.key.value;
  return null;
}

function isTamaguiSheet(node) {
  return (
    node?.type === 'CallExpression' &&
    node.callee.type === 'MemberExpression' &&
    node.callee.object.type === 'Identifier' &&
    node.callee.object.name === '__ReactNativeStyleSheet' &&
    node.callee.property.type === 'Identifier' &&
    node.callee.property.name === 'create' &&
    node.arguments[0]?.type === 'ObjectExpression'
  );
}

module.exports = function androidTextStyles(api) {
  api.assertVersion(7);
  const t = api.types;
  const replacements = buildReplacements(api);

  function replaceStyle(style) {
    const props = {};
    for (const property of style.properties) {
      const name = propertyName(property);
      if (name) props[name] = property;
    }

    const androidTrim =
      props.marginTop &&
      props.marginBottom &&
      replacements.trims.get(
        trimKey(
          numberValue(props.marginTop.value),
          numberValue(props.marginBottom.value)
        )
      );
    if (androidTrim) {
      props.marginTop.value = t.valueToNode(androidTrim.marginTop);
      props.marginBottom.value = t.valueToNode(androidTrim.marginBottom);
    }

    const family = props.fontFamily?.value;
    if (family?.type === 'StringLiteral') {
      const androidFamily = replacements.fontFamilies.get(family.value);
      if (androidFamily) {
        props.fontFamily.value = t.stringLiteral(androidFamily);
      }
    }
  }

  return {
    name: 'tlon-android-text-styles',
    visitor: {
      Program: {
        exit(programPath) {
          // The compiler puts its sheet at the top level of the file.
          for (const statement of programPath.node.body) {
            if (statement.type !== 'VariableDeclaration') continue;
            for (const declarator of statement.declarations) {
              if (!isTamaguiSheet(declarator.init)) continue;
              for (const entry of declarator.init.arguments[0].properties) {
                if (entry.value?.type === 'ObjectExpression') {
                  replaceStyle(entry.value);
                }
              }
            }
          }
        },
      },
    },
  };
};

module.exports.buildReplacements = buildReplacements;

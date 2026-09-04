// Codegen-only shim: just enough of tamagui's API surface for
// tamagui.config.ts to evaluate outside React Native. createTokens mirrors
// the real behavior the config itself relies on (leaves become `{ val }`).
export function createTokens(groups) {
  const wrapped = {};
  for (const [groupName, group] of Object.entries(groups)) {
    wrapped[groupName] = {};
    for (const [key, val] of Object.entries(group)) {
      wrapped[groupName][key] = { val };
    }
  }
  return wrapped;
}

export function createFont(font) {
  return font;
}

export function createTamagui(config) {
  return config;
}

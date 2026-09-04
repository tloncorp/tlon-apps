// Codegen-only shim for @tamagui/animations-moti and
// @tamagui/react-native-media-driver: identity is enough — the token
// codegen never reads animations or media queries.
export function createAnimations(animations) {
  return animations;
}

export function createMedia(media) {
  return media;
}

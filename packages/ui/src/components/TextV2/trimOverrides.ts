// Hand-tuned adjustments on top of the generated values in trimSettings.tsx.
// Emoji are in general larger than text, so their bottom margin needs less
// trimming. Kept as plain literals: the Android text-style Babel plugin
// (packages/ui/babel/androidTextStyles.cjs) reads this file as data.
export const trimOverrides = {
  ios: {
    '$emoji/l': { marginBottom: 0 },
  },
  android: {
    '$emoji/l': { marginBottom: -2 },
  },
};

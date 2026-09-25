import { PhoneNumberTransformer } from 'react-native-transformer-text-input/formatters/phone-number';
import { describe, expect, it } from 'vitest';

// Drive the transformer's worklet the way TransformerTextInput does on each
// keystroke: the new text is the previous formatted value plus the typed key,
// with the caret at the end.
function typeKeys(transformer: PhoneNumberTransformer, keys: string): string {
  const worklet = transformer.worklet;
  let value = '';
  for (const key of keys) {
    const previousValue = value;
    const next = previousValue + key;
    const result = worklet({
      value: next,
      previousValue,
      selection: { start: next.length, end: next.length },
      previousSelection: {
        start: previousValue.length,
        end: previousValue.length,
      },
    });
    value = result?.value ?? next;
  }
  return value;
}

// Covers patches/react-native-transformer-text-input@0.4.1.patch. The NANP
// country data lists Canada's 7-digit "310-XXXX" service format ahead of the
// 10-digit format, and the unpatched transformer picked a format by leading
// digits alone, clamping every +1 310 number to seven digits (TLON-6686).
describe('PhoneNumberTransformer (international)', () => {
  const international = () =>
    new PhoneNumberTransformer({ international: true });

  it('accepts all ten digits of a 310-area-code number', () => {
    expect(typeKeys(international(), '+13102705123')).toBe('+1 (310) 270-5123');
  });

  it('still formats a genuine 7-digit 310 service number', () => {
    expect(typeKeys(international(), '+13102705')).toBe('+1 310-2705');
  });

  it('still caps a NANP number at ten digits', () => {
    expect(typeKeys(international(), '+131027051234')).toBe(
      '+1 (310) 270-5123'
    );
    expect(typeKeys(international(), '+141555526711')).toBe(
      '+1 (415) 555-2671'
    );
  });

  it('formats other area codes and countries as before', () => {
    expect(typeKeys(international(), '+14155552671')).toBe('+1 (415) 555-2671');
    expect(typeKeys(international(), '+442079460958')).toBe('+44 20 7946 0958');
    expect(typeKeys(international(), '+33612345678')).toBe('+33 6 12 34 56 78');
  });
});

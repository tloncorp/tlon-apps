// Note: the import statement for sigil is different in the native version
// The native version uses the core entry point of sigil-js
// The web version uses the default entry point of sigil-js
import sigil from '@urbit/sigil-js';

export const makeSigil = sigil;

export const UrbitSigilSvg = function ({ xml }: { xml: string }) {
  // Not tested, probably doesn't work, sorry!!
  return <img src={`data:image/svg+xml;utf8,${encodeURIComponent(xml)}`} />;
};

// Note: the import statement for sigil is different in the native version
// The native version uses the core entry point of sigil-js
// The web version uses the default entry point of sigil-js
import sigil from '@urbit/sigil-js/dist/core';
import { SvgXml } from 'react-native-svg';

export const makeSigil = sigil;

export const UrbitSigilSvg = function ({ xml }: { xml: string }) {
  return <SvgXml shouldRasterizeIOS={true} xml={xml} />;
};

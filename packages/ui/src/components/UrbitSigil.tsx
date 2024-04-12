import { useMemo } from 'react';

import { UrbitSigilSvg, makeSigil } from './UrbitSigilSvg';

function UrbitSigil({
  contactId,
  colors,
  renderDetail = false,
  padding = 'none',
  size = 24,
  ...props
}: {
  contactId: string;
  colors?: {
    backgroundColor: string;
    foregroundColor: string;
  };
  renderDetail?: boolean;
  padding?: 'none' | 'default' | 'large';
  size?: number;
}) {
  const validId = contactId.length <= 14; // planet or larger
  const sigilXml = useMemo(
    () =>
      validId
        ? makeSigil({
            point: contactId,
            detail: renderDetail ? 'default' : 'none',
            size: size,
            space: padding,
            foreground: colors?.foregroundColor,
            background: colors?.backgroundColor,
          })
        : null,
    [contactId, validId, size, colors?.foregroundColor, colors?.backgroundColor]
  );
  return sigilXml ? <UrbitSigilSvg xml={sigilXml} /> : null;
}

export default UrbitSigil;

import { RawText } from '@tloncorp/ui';
import React from 'react';
import { ColorTokens } from 'tamagui';

import {
  BoldText,
  CodeText,
  ItalicText,
  StrikethroughText,
} from './InlineRenderer';
import { InlineRenderer } from './InlineRenderer';
import { InlineData, StyleInlineData } from './contentUtils';

/**
 * Renders a styled inline element with proper support for nested formatting
 */
export function InlineStyle({
  inline,
  ...props
}: {
  inline: StyleInlineData;
  color?: ColorTokens;
}) {
  const StyleComponent = {
    bold: BoldText,
    italic: ItalicText,
    strikethrough: StrikethroughText,
    code: CodeText,
  }[inline.style];

  // Properly render nested inline elements with their formatting intact
  return (
    <StyleComponent {...props}>
      {inline.children.map((child, i) => {
        // Pass color prop to children to maintain consistent styling
        return <InlineRenderer key={i} inline={child} color={props.color} />;
      })}
    </StyleComponent>
  );
}

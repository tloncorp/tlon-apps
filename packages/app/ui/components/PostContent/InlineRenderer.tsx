import {
  InlineData,
  InlineFromType,
  LinkInlineData,
  MentionInlineData,
  StyleInlineData,
  TaskInlineData,
  TextInlineData,
} from '@tloncorp/shared/logic';
import { RawText, Text } from '@tloncorp/ui';
import React, { PropsWithChildren, useCallback, useContext } from 'react';
import { Linking, Platform } from 'react-native';
import { ColorTokens, styled } from 'tamagui';

import { useNavigation } from '../../contexts';
import { useContactName } from '../ContactNameV2';

export const CodeText = styled(Text, {
  name: 'CodeText',
  size: '$mono/m',
  color: '$primaryText',
  backgroundColor: '$secondaryBackground',
  padding: '$xs',
  borderRadius: '$s',
});

export const StrikethroughText = styled(RawText, {
  name: 'StrikethroughText',
  textDecorationLine: 'line-through',
});

export const BoldText = styled(RawText, {
  name: 'BoldText',
  fontWeight: 'bold',
});

export const ItalicText = styled(RawText, {
  name: 'ItalicText',
  fontStyle: 'italic',
});

export const MentionText = styled(Text, {
  name: 'MentionText',
  color: '$positiveActionText',
  backgroundColor: '$positiveBackground',
  cursor: 'pointer',
});

export function InlineMention({
  inline,
}: PropsWithChildren<{
  inline: MentionInlineData;
}>) {
  const contactName = useContactName(inline.contactId);
  const { onGoToUserProfile } = useNavigation();
  const handlePress = useCallback(() => {
    onGoToUserProfile?.(inline.contactId);
  }, [onGoToUserProfile, inline.contactId]);
  return (
    <MentionText onPress={handlePress} color={'$positiveActionText'}>
      {contactName}
    </MentionText>
  );
}

export function InlineLineBreak() {
  return '\n';
}

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

  return (
    <StyleComponent {...props}>
      {inline.children.map((child, i) => (
        <InlineRenderer inline={child} key={i} />
      ))}
    </StyleComponent>
  );
}

export function InlineText({
  inline,
  color,
}: {
  inline: TextInlineData;
  color?: ColorTokens;
}) {
  return color ? <RawText color={color}>{inline.text}</RawText> : inline.text;
}

export function InlineLink({ inline: node }: { inline: LinkInlineData }) {
  const handlePress = useCallback(() => {
    if (Platform.OS === 'web') {
      window.open(node.href, '_blank', 'noopener,noreferrer');
    } else {
      Linking.openURL(node.href);
    }
  }, [node.href]);

  return (
    <Text cursor="pointer" textDecorationLine="underline" onPress={handlePress}>
      {node.text || node.href}
    </Text>
  );
}

export function InlineTask({ inline: node }: { inline: TaskInlineData }) {
  return (
    <Text>
      {node.checked ? '☑' : '☐'}{' '}
      {node.children.map((child, i) => (
        <InlineRenderer inline={child} key={i} />
      ))}
    </Text>
  );
}

export type InlineRenderer<T extends InlineData> = React.ComponentType<{
  inline: T;
  color?: ColorTokens;
}>;

export type InlineRendererConfig = {
  [K in InlineData['type']]: InlineRenderer<InlineFromType<K>>;
};

export const defaultInlineRenderers: InlineRendererConfig = {
  text: InlineText,
  style: InlineStyle,
  mention: InlineMention,
  lineBreak: InlineLineBreak,
  link: InlineLink,
  task: InlineTask,
};

const InlineRendererContext = React.createContext<
  Partial<InlineRendererConfig> | undefined
>(undefined);

export const InlineRendererProvider = React.memo(
  InlineRendererContext.Provider
);

export function InlineRenderer({
  inline,
  ...props
}: {
  inline: InlineData | null;
  color?: ColorTokens;
}) {
  const renderers = useContext(InlineRendererContext);
  if (inline === null) {
    return null;
  }
  const Component = (renderers?.[inline.type] ??
    defaultInlineRenderers[inline.type]) as InlineRenderer<typeof inline>;
  return <Component inline={inline} {...props} />;
}

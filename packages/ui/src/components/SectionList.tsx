import { getRadius } from '@tamagui/get-token';
import { useCallback, useMemo } from 'react';
import {
  Platform,
  SectionList,
  SectionListData,
  SectionListProps,
  SectionListRenderItemInfo,
} from 'react-native';
import { View, styled, withStaticProperties } from 'tamagui';

import { SizableText } from '../core';

const SectionListHeaderFrame = styled(View, {
  paddingHorizontal: '$l',
  paddingVertical: '$m',
});

const SectionListHeaderText = styled(SizableText, {
  size: '$s',
  color: '$secondaryText',
  lineHeight: Platform.OS === 'ios' ? 0 : undefined,
});

export const SectionListHeader = withStaticProperties(SectionListHeaderFrame, {
  Text: SectionListHeaderText,
});

export const BlockSectionListHeader = styled(View, {
  backgroundColor: '$secondaryBackground',
  borderTopLeftRadius: '$2xl',
  borderTopRightRadius: '$2xl',
  paddingLeft: '$2xl',
  paddingTop: '$xl',
  paddingBottom: '$l',
});

const BlockSectionListHeaderText = SectionListHeaderText;

export const BlockSectionListItemWrapper = styled(View, {
  backgroundColor: '$secondaryBackground',
  paddingHorizontal: '$l',
});

export const BlockSectionListFooter = View.styleable(
  (props, ref) => {
    return (
      <View
        ref={ref}
        overflow={'hidden'}
        height="$2xl"
        justifyContent="flex-end"
        marginBottom="$s"
      >
        <View
          backgroundColor={'$secondaryBackground'}
          height="$4xl"
          borderBottomRightRadius="$2xl"
          borderBottomLeftRadius={'$2xl'}
        ></View>
      </View>
    );
  },
  {
    staticConfig: {},
  }
);

export const BlockSectionListComponent = <
  TItem,
  TSection extends { label: string; data: TItem[] },
>({
  renderItem,
  style,
  ...props
}: SectionListProps<TItem, TSection>) => {
  const renderSectionHeader = useCallback(
    ({ section }: { section: SectionListData<TItem, TSection> }) => {
      return (
        <BlockSectionListHeader>
          <BlockSectionListHeaderText>
            {section.label}
          </BlockSectionListHeaderText>
        </BlockSectionListHeader>
      );
    },
    []
  );
  const renderSectionFooter = useCallback(() => {
    return <BlockSectionList.Footer />;
  }, []);

  const renderSectionItem = useCallback(
    (info: SectionListRenderItemInfo<TItem, TSection>) => {
      return (
        <BlockSectionList.ItemWrapper>
          {renderItem?.(info)}
        </BlockSectionList.ItemWrapper>
      );
    },
    [renderItem]
  );

  const listStyle = useMemo(() => {
    return {
      borderTopLeftRadius: getRadius('$2xl').val,
      borderTopRightRadius: getRadius('$2xl').val,
      overflow: 'hidden',
    } as const;
  }, []);

  return (
    <SectionList
      stickySectionHeadersEnabled={false}
      renderItem={renderSectionItem}
      renderSectionHeader={renderSectionHeader}
      renderSectionFooter={renderSectionFooter}
      style={[listStyle, style]}
      {...props}
    />
  );
};

export const BlockSectionList = withStaticProperties(
  BlockSectionListComponent,
  {
    Header: BlockSectionListHeader,
    Footer: BlockSectionListFooter,
    ItemWrapper: BlockSectionListItemWrapper,
  }
);

import {
  Block,
  Header,
  Listing,
  Story,
  Image as StoryImage,
  VerseBlock,
  VerseInline,
  isImage,
} from '@api/types/channel';
import {
  Inline,
  isBlockCode,
  isBlockquote,
  isBold,
  isBreak,
  isInlineCode,
  isItalics,
  isLink,
  isShip,
  isStrikethrough,
} from '@api/types/content';
import * as db from '@db';
import {Image, SizableText, Stack, Text, XStack, YStack} from '@ochre';
import {TextStyleProps} from '@tamagui/core';
import {
  syncAppReference,
  syncChannelReference,
  syncGroupReference,
} from '../utils/sync';
import React, {ReactElement, useCallback, useEffect, useMemo} from 'react';
import {Linking} from 'react-native';

import {SizableTextProps, styled} from 'tamagui';
import {PostListItem} from './ObjectListItem';

interface PostContentProps {
  story: Story;
  className?: string;
  writId?: string;
}

interface BlockContentProps {
  story: Block;
  writId: string;
  blockIndex: number;
}

interface ShipMentionProps {
  ship: string;
}

function ShipMention({ship}: ShipMentionProps) {
  // Replace hyphen with non-breakin hyphen to prevent line breaks in the middle
  // of the ship name.
  const formattedShip = useMemo(() => ship.replace('-', '\u2011'), [ship]);
  return (
    <SizableText backgroundColor={'$anchorHighlight'}>
      {formattedShip}
    </SizableText>
  );
}
const italicStyle = {fontStyle: 'italic'} as const;
const Italic = (props: SizableTextProps) => {
  return <StyleNode {...props} textStyle={italicStyle} />;
};

const boldStyle = {fontWeight: '500', color: 'red'} as const;

const Bold = (props: SizableTextProps) => {
  return <StyleNode {...props} textStyle={boldStyle} />;
};

const StyleNode = ({
  children,
  textStyle,
}: {
  textStyle?: TextStyleProps;
  children?: ReactElement | string | Array<ReactElement | string>;
}) => {
  if (!children) {
    return null;
  }
  if (typeof children === 'string') {
    return <SizableText {...textStyle}>{children}</SizableText>;
  } else if (Array.isArray(children)) {
    return children.map((child, index) => {
      return (
        <StyleNode key={index} textStyle={textStyle}>
          {child}
        </StyleNode>
      );
    });
  } else if (children) {
    return React.cloneElement(children, {textStyle});
  }
  return null;
};

function BlockQuote({children}: {children: React.ReactNode}) {
  return (
    <Stack backgroundColor={'$secondaryBackground'}>
      <SizableText>{children}</SizableText>
    </Stack>
  );
}

function Code({children}: {children: React.ReactNode}) {
  return (
    <SizableText
      fontFamily={'$mono'}
      padding="$xs"
      paddingHorizontal="$s"
      backgroundColor="$secondaryBackground">
      {children}
    </SizableText>
  );
}

function CodeBlock({children}: {children: React.ReactNode}) {
  return (
    <Stack width="100%">
      <Code>{children}</Code>
    </Stack>
  );
}

interface InlineContentProps {
  story: Inline;
  writId?: string;
  textStyle?: TextStyleProps;
}

export function InlineContent({story, textStyle}: InlineContentProps) {
  if (typeof story === 'string') {
    return <StyleNode textStyle={textStyle}>{story}</StyleNode>;
  }

  if (isBold(story)) {
    return (
      <Bold {...textStyle}>
        {story.bold.map((s, k) => (
          <InlineContent key={k} story={s} textStyle={textStyle} />
        ))}
      </Bold>
    );
  }

  if (isItalics(story)) {
    return (
      <Italic {...textStyle}>
        {story.italics.map((s, k) => (
          <InlineContent key={k} story={s} textStyle={textStyle} />
        ))}
      </Italic>
    );
  }

  if (isStrikethrough(story)) {
    return (
      <SizableText>
        {story.strike.map((s, k) => (
          <InlineContent key={k} story={s} textStyle={textStyle} />
        ))}
      </SizableText>
    );
  }

  if (isLink(story)) {
    const content =
      story.link.content === '' ? story.link.href : story.link.content;
    return <Link href={story.link.href} text={content} />;
  }

  if (isBlockquote(story)) {
    return (
      <BlockQuote>
        {Array.isArray(story.blockquote)
          ? story.blockquote.map((item, index) => (
              <InlineContent
                key={item.toString() + index}
                textStyle={textStyle}
                story={item}
              />
            ))
          : story.blockquote}
      </BlockQuote>
    );
  }

  if (isInlineCode(story)) {
    return (
      <Code>
        {typeof story['inline-code'] === 'object' ? (
          <InlineContent story={story['inline-code']} />
        ) : (
          story['inline-code']
        )}
      </Code>
    );
  }

  if (isBlockCode(story)) {
    return <CodeBlock>{story.code}</CodeBlock>;
  }

  if (isShip(story)) {
    return <ShipMention ship={story.ship} />;
  }

  if (isBreak(story)) {
    return null;
  }

  console.log('unrenderable story', story);

  return <SizableText>{JSON.stringify(story)}</SizableText>;
}

export function Link({href, text}: {href: string; text: string}) {
  const handlePress = useCallback(() => {
    Linking.openURL(href);
  }, [href]);
  return (
    <SizableText textDecorationLine="underline" onPress={handlePress}>
      {text}
    </SizableText>
  );
}

export function BlockContent({story}: BlockContentProps) {
  if (isImage(story)) {
    return <ImageContent image={story.image} />;
  }

  if ('header' in story) {
    return <HeaderContent header={story.header} />;
  }

  if ('rule' in story) {
    return <Rule />;
  }

  if ('listing' in story) {
    return <ListingContent listing={story.listing} />;
  }

  if ('code' in story) {
    return (
      <CodeBlock>
        <Code>{story.code.code}</Code>
      </CodeBlock>
    );
  }

  return <SizableText>{JSON.stringify(story)}</SizableText>;
}

function ContentReference({reference}: {reference: db.ContentReference}) {
  if (reference.referenceType === 'channel') {
    return <ChannelReference reference={reference} />;
  } else if (reference.referenceType === 'group') {
    return <GroupReference reference={reference} />;
  } else if (reference.referenceType === 'app') {
    return <AppReference reference={reference} />;
  } else {
    return (
      <XStack
        padding="$xs"
        borderRadius={'$xs'}
        backgroundColor={'$secondaryBackground'}>
        <SizableText>{JSON.stringify(reference)}</SizableText>
      </XStack>
    );
  }
}

function GroupReference({reference}: {reference: db.GroupReference}) {
  const ops = db.useOps();
  useEffect(() => {
    syncGroupReference(reference, ops);
  }, [ops, reference]);
  return null;
}

function AppReference({reference}: {reference: db.AppReference}) {
  const ops = db.useOps();
  const app = db.useObject('App', reference.userId + '/' + reference.appId);
  useEffect(() => {
    syncAppReference(reference, ops);
  }, [ops, reference]);
  const iconBorderWidth = app?.color.toUpperCase() === '#FFFFFF' ? 1 : 0;
  console.log(
    app?.color,
    app?.image,
    app?.color?.toUpperCase(),
    app?.color.toUpperCase() === '#FFFFFF',
    iconBorderWidth,
  );
  console;
  return (
    <XStack
      padding="$m"
      borderColor="$border"
      borderRadius="$m"
      borderWidth={1}>
      {app ? (
        <XStack gap="$s">
          <Stack
            //@ts-ignore user-supplied color
            backgroundColor={app.color}
            borderColor="$border"
            borderWidth={iconBorderWidth}
            borderRadius="$s"
            width={'$l'}
            height={'$l'}
            flexShrink={0}>
            <Image
              source={{uri: app.image}}
              width={100}
              height={100}
              borderRadius="$s"
            />
          </Stack>
          <YStack>
            <XStack gap="$s">
              <SizableText size="$s">
                {app.title} by {app.publisherId}
              </SizableText>
            </XStack>
            <SizableText size="$s">Application</SizableText>
          </YStack>
        </XStack>
      ) : (
        <SizableText>Loading</SizableText>
      )}
    </XStack>
  );
}

function ChannelReference({reference}: {reference: db.ChannelReference}) {
  const ops = db.useOps();
  const post = db.useObject('Post', reference.postId);

  useEffect(() => {
    if (!post) {
      syncChannelReference(reference, ops);
    }
  }, [ops, reference, post]);

  return post ? (
    <PostListItem
      model={post}
      borderColor={'$border'}
      borderWidth={1}
      borderRadius={'$m'}
    />
  ) : (
    <SizableText>Ref not loaded</SizableText>
  );
}

function ImageContent({image}: {image: StoryImage['image']}) {
  //@ts-ignore: style prop is erroring as it doesn't want to accept a string for
  return (
    <Image
      flexShrink={1}
      width="100%"
      borderRadius="$s"
      aspectRatio={
        (Math.max(image.width, 1) ?? 1) / (Math.max(image.height, 1) ?? 1)
      }
      backgroundColor={'$secondaryBackground'}
      source={{uri: image.src}}
    />
  );
}

function ListingContent({
  listing,
  depth = 0,
}: {
  listing: Listing;
  depth?: number;
}) {
  if ('list' in listing) {
    return listing.list.items.map((item, i) => {
      return <ListingContent key={i} listing={item} depth={depth + 1} />;
    });
  } else if ('item' in listing) {
    return (
      <XStack gap={2}>
        <SizableText>●</SizableText>
        <YStack>
          <SizableText>
            {listing.item.map((content, i) => (
              <InlineContent key={i} story={content} />
            ))}
          </SizableText>
        </YStack>
      </XStack>
    );
  }
  return null;
}

const Rule = styled(Stack, {
  borderWidth: 1,
  borderTopColor: '$primaryText',
  padding: 10,
});

function HeaderContent({header}: {header: Header['header']}) {
  return <SizableText>{header.content.join('\n')}</SizableText>;
}

function PostContent({story = [], writId = 'not-writ'}: PostContentProps) {
  const storyInlines = (
    story.filter(s => s && 'inline' in s) as VerseInline[]
  ).flatMap(i => i.inline);
  const storyBlocks = story.filter(s => (s && 'block' in s) || 'type' in s) as (
    | VerseBlock
    | db.ContentReference
  )[];
  // const inlineLength = storyInlines.length;
  // const blockLength = storyBlocks.length;
  // const firstBlockCode = storyInlines.findIndex(isBlockCode);
  // const lastBlockCode = findLastIndex(storyInlines, isBlockCode);
  const blockContent = storyBlocks.sort((a, b) => {
    // Sort images to the end
    if (isImage(a) && !isImage(b)) {
      return 1;
    }
    if (!isImage(a) && isImage(b)) {
      return -1;
    }
    return 0;
  });

  const inlineGroups = useMemo(
    () =>
      storyInlines.reduce<Inline[][]>(
        (acc, inline, index) => {
          const isBlock = isBlockquote(inline) || isBlockCode(inline);
          const previousItem = storyInlines[index - 1];
          const afterBlock =
            previousItem &&
            (isBlockquote(previousItem) || isBlockCode(previousItem));
          if (isBlock || afterBlock) {
            acc.push([inline]);
          } else {
            if (!acc.length) {
              acc.push([]);
            }
            acc[acc.length - 1]!.push(inline);
          }
          return acc;
        },
        [[]],
      ),
    [storyInlines],
  );

  return (
    <YStack gap="$xs">
      {blockContent
        .filter(a => !!a)
        .map((storyItem, index) => {
          console.log(storyItem, index);
          return (
            <Stack key={`${storyItem.toString()}-${index}`}>
              {isContentReference(storyItem) ? (
                <ContentReference reference={storyItem} />
              ) : (
                <BlockContent
                  story={storyItem.block}
                  writId={writId}
                  blockIndex={index}
                />
              )}
            </Stack>
          );
        })}

      {inlineGroups.map((items, index) => {
        const isBlock = items.length === 1;
        if (isBlock) {
          return (
            <Stack key={index}>
              <InlineContent key={index} story={items[0]!} writId={writId} />
            </Stack>
          );
        }

        return items.length ? (
          <Text key={index}>
            {items.map((storyItem, itemIndex) => {
              return (
                <InlineContent
                  key={`${storyItem.toString()}-${itemIndex}`}
                  story={storyItem}
                  writId={writId}
                />
              );
            })}
          </Text>
        ) : null;
      })}
    </YStack>
  );
}

function isContentReference(t: unknown): t is db.ContentReference {
  return t instanceof Object && 'type' in t && t.type === 'reference';
}

export default React.memo(PostContent);

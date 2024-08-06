import { makePrettyShortDate } from '@tloncorp/shared/src/logic/utils';
import { ColorTokens } from 'tamagui';
import { SizableText, View, XStack, YStack } from 'tamagui';

import { LoadingSpinner } from '../LoadingSpinner';
import { SearchState } from './types';

export function SearchStatus({
  search,
  color,
}: {
  search: SearchState;
  color?: ColorTokens;
}) {
  const { searchComplete, errored, numResults, searchedThroughDate } = search;

  return (
    <XStack justifyContent="center" alignItems="center">
      {errored ? (
        <SizableText size="$s" color="$negativeActionText">
          Error searching
        </SizableText>
      ) : (
        <>
          {!searchComplete && (
            <View marginRight="$s">
              <LoadingSpinner />
            </View>
          )}
          {numResults > 0 && (
            <SizableText size="$s" color={color ?? '$secondaryText'}>
              <SizableText size="$s" color="$primaryText" fontWeight="$xl">
                {numResults}
              </SizableText>
              {` results  ·  `}
            </SizableText>
          )}
        </>
      )}
      <SearchDepthDisplay
        searchComplete={searchComplete}
        searchedThroughDate={searchedThroughDate}
        color={color}
      />
    </XStack>
  );
}

function SearchDepthDisplay({
  searchComplete,
  searchedThroughDate,
  color,
}: {
  searchComplete: boolean;
  searchedThroughDate: Date | null;
  color?: ColorTokens;
}) {
  if (searchComplete) {
    return (
      <SizableText size="$s" color={color ?? '$secondaryText'}>
        Searched all channel history
      </SizableText>
    );
  }

  if (searchedThroughDate) {
    return (
      <SizableText size="$s" color={color ?? '$secondaryText'}>
        Searched through {makePrettyShortDate(searchedThroughDate)}
      </SizableText>
    );
  }

  return (
    <SizableText size="$s" color={color ?? '$secondaryText'}>
      Searching...
    </SizableText>
  );
}

export function SearchHeadline(search: SearchState) {
  if (search.query === '') {
    return <SizableText></SizableText>;
  }
}

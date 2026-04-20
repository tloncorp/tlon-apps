import { SUGGESTED_NAMES } from '@tloncorp/shared/domain';
import React from 'react';
import { View } from 'tamagui';

import { TextInputWithSuggestions } from '../ui/components/TextInputWithSuggestions';
import { FixtureWrapper } from './FixtureWrapper';

function DefaultFixture() {
  const [value, setValue] = React.useState('');

  return (
    <FixtureWrapper fillWidth>
      <View padding="$xl">
        <TextInputWithSuggestions
          value={value}
          onChangeText={setValue}
          placeholder="Give your bot a name"
          suggestions={SUGGESTED_NAMES}
        />
      </View>
    </FixtureWrapper>
  );
}

function WithCustomLabelFixture() {
  const [value, setValue] = React.useState('');

  return (
    <FixtureWrapper fillWidth>
      <View padding="$xl">
        <TextInputWithSuggestions
          value={value}
          onChangeText={setValue}
          placeholder="Enter a topic"
          suggestions={['Design', 'Engineering', 'Product', 'Marketing', 'Sales']}
          suggestionsLabel="Topics"
        />
      </View>
    </FixtureWrapper>
  );
}

function PrefilledFixture() {
  const [value, setValue] = React.useState('Sage');

  return (
    <FixtureWrapper fillWidth>
      <View padding="$xl">
        <TextInputWithSuggestions
          value={value}
          onChangeText={setValue}
          placeholder="Give your bot a name"
          suggestions={SUGGESTED_NAMES}
        />
      </View>
    </FixtureWrapper>
  );
}

export default {
  Default: <DefaultFixture />,
  'With Custom Label': <WithCustomLabelFixture />,
  Prefilled: <PrefilledFixture />,
};

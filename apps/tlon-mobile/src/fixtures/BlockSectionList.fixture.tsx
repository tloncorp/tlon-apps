import * as db from '@tloncorp/shared/dist/db';
import { BlockSectionList, ContactRow } from '@tloncorp/ui';
import { SectionListRenderItemInfo } from 'react-native';

import { FixtureWrapper } from './FixtureWrapper';
import { initialContacts } from './fakeData';

const sections = 'abcdefghijklmnopqrstuvwxyz'.split('').map((letter, i) => {
  return {
    label: letter.toUpperCase(),
    data: initialContacts.slice(0, (i % 4) + 1),
  };
});

const renderItem = ({
  item,
}: SectionListRenderItemInfo<db.Contact, { label: string }>) => {
  return (
    <ContactRow
      backgroundColor={'$secondaryBackground'}
      key={item.id}
      contact={item}
      selectable={true}
      selected={false}
      onPress={() => {}}
    />
  );
};

export default {
  default: (
    <FixtureWrapper fillWidth fillHeight safeArea>
      <BlockSectionList sections={sections} renderItem={renderItem} />
    </FixtureWrapper>
  ),
};

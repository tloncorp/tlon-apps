import { GroupMetaScreenView } from '@tloncorp/ui';

import { FixtureWrapper } from './FixtureWrapper';
import { group } from './fakeData';

const GroupMetaScreenFixture = () => {
  return (
    <FixtureWrapper>
      <GroupMetaScreenView
        group={group}
        currentUserIsAdmin={true}
        deleteGroup={() => console.log('deleteGroup')}
        goBack={() => console.log('goBack')}
        setGroupMetadata={() => console.log('setGroupMetadata')}
        uploadInfo={{
          imageAttachment: null,
          setAttachments: () => console.log('setAttachments'),
          resetImageAttachment: () => console.log('resetImageAttachment'),
          canUpload: true,
          uploading: false,
        }}
      />
    </FixtureWrapper>
  );
};

export default GroupMetaScreenFixture;

import { postWithLongNote } from '../contentHelpers';
import { tlonLocalGettingStarted } from '../fakeData';
import { DetailViewFixture } from './detailViewFixtureBase';

const channel = tlonLocalGettingStarted;

export default <DetailViewFixture channel={channel} post={postWithLongNote} />;

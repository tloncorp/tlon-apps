import { postWithImageAndText } from '../contentHelpers';
import { tlonLocalIntros } from '../fakeData';
import { DetailViewFixture } from './detailViewFixtureBase';

const channel = tlonLocalIntros;

export default (
  <DetailViewFixture channel={channel} post={postWithImageAndText} />
);

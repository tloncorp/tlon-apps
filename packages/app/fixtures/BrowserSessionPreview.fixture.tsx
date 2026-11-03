import { YStack } from 'tamagui';
import { BrowserPreviewContent } from '../features/browser/BrowserSessionPreview';
const noop = () => {};
export default {
  Loading: (
    <YStack padding="$l">
      <BrowserPreviewContent preview={{ status: 'busy' }} onOpen={noop} />
    </YStack>
  ),
  Credentials: (
    <YStack padding="$l">
      <BrowserPreviewContent preview={{ status: 'protected' }} onOpen={noop} />
    </YStack>
  ),
  Ended: (
    <YStack padding="$l">
      <BrowserPreviewContent preview={{ status: 'ended' }} onOpen={noop} />
    </YStack>
  ),
};

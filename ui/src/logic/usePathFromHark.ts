import { udToDec } from '@urbit/api';
import { useWritByFlagAndWritId } from '@/state/chat';
import { Skein } from '@/types/hark';

export default function usePathFromHark(bin: Skein, isMention: boolean) {
  const writId = bin.top?.wer.split('/')[10];
  const ship =
    typeof bin.top.con[0] !== 'string' && 'ship' in bin.top.con[0]
      ? bin.top?.con[0].ship
      : '';
  const channelFlag = `${bin.top?.wer.split('/')[6]}/${
    bin.top?.wer.split('/')[7]
  }`;
  const idWrit = `${ship}/${writId}`;
  const replyToWrit = useWritByFlagAndWritId(channelFlag, idWrit || '', false)
    ?.memo.replying;
  const wer = bin.top?.wer;

  if (isMention) {
    if (replyToWrit) {
      // if the mention is within a thread, we need to go to the thread and scroll to the message.
      const split = wer.split('/');
      const msg = split[split.length - 1];
      const newPath = split
        .slice(0, 9)
        .join('/')
        .concat(`/${replyToWrit}`)
        .concat(`?msg=${udToDec(msg)}`);
      return newPath;
    }

    // if the mention is in a normal message, we need to go to the chat channel and scroll to the message.
    // the backend sends the mention path as /message/@p/message/@ud
    // we need to convert it to ?msg=@t
    const split = wer.split('/');
    const msg = split[split.length - 1];
    const newPath = wer
      .split('/')
      .slice(0, 8)
      .join('/')
      .concat(`?msg=${udToDec(msg)}`);
    return newPath;
  }
  return wer;
}

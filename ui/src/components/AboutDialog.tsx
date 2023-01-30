import { isTalk, useCopy } from '@/logic/utils';
import { usePike } from '@/state/kiln';
import Dialog, { DialogContent } from './Dialog';
import IconButton from './IconButton';
import CheckIcon from './icons/CheckIcon';
import CopyIcon from './icons/CopyIcon';

export default function AboutDialog() {
  const pike = usePike(isTalk ? 'talk' : 'groups');
  const { didCopy: didCopyHash, doCopy: doCopyHash } = useCopy(
    pike?.hash || ''
  );
  const { didCopy: didCopyShip, doCopy: doCopyShip } = useCopy(
    pike?.sync?.ship || ''
  );

  const appDescription = isTalk
    ? `Send encrypted direct messages to one or many friends.
    Talk is a simple chat tool for catching up, getting work done,
    and everything in between.`
    : `Start, host, and cultivate communities. Own your communications,
            organize your resources, and share documents. Groups is a
            decentralized platform that integrates with Talk, Notebook, and
            Gallery for a full, communal suite of tools.`;

  return (
    <Dialog defaultOpen modal>
      <DialogContent
        onInteractOutside={(e) => e.preventDefault()}
        className="w-[500px] sm:inset-y-24"
      >
        <div className="flex flex-col space-y-2">
          <span className="text-lg font-bold">
            About {isTalk ? 'Talk' : 'Groups'}
          </span>
          <span className="text-sm text-gray-500">{appDescription}</span>
          <div className="flex flex-row items-center text-sm">
            <span className="font-bold text-gray-500">Hash:</span>
            <code className="ml-2 break-all">{pike?.hash}</code>
            <IconButton
              label="Copy Hash"
              icon={
                didCopyHash ? (
                  <CheckIcon className="h-6 w-6 text-gray-400" />
                ) : (
                  <CopyIcon className="h-6 w-6 text-gray-400" />
                )
              }
              action={doCopyHash}
            />
          </div>
          <div className="flex flex-row items-center text-sm">
            <span className="font-bold text-gray-500">Source:</span>
            <code className="ml-2 break-all">{pike?.sync?.ship}</code>
            <IconButton
              label="Copy Hash"
              icon={
                didCopyShip ? (
                  <CheckIcon className="h-6 w-6 text-gray-400" />
                ) : (
                  <CopyIcon className="h-6 w-6 text-gray-400" />
                )
              }
              action={doCopyShip}
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

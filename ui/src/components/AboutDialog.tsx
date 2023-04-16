import { useDismissNavigate } from '@/logic/routing';
import { isTalk, useCopy } from '@/logic/utils';
import { useCharge } from '@/state/docket';
import { usePike } from '@/state/kiln';
import Dialog from './Dialog';
import IconButton from './IconButton';
import CheckIcon from './icons/CheckIcon';
import CopyIcon from './icons/CopyIcon';

export default function AboutDialog() {
  const dismiss = useDismissNavigate();
  const pike = usePike(isTalk ? 'talk' : 'groups');
  const charge = useCharge(isTalk ? 'talk' : 'groups');
  const { didCopy: didCopyHash, doCopy: doCopyHash } = useCopy(
    pike?.hash || ''
  );
  const { didCopy: didCopyShip, doCopy: doCopyShip } = useCopy(
    pike?.sync?.ship || ''
  );
  const { didCopy: didCopyVersion, doCopy: doCopyVersion } = useCopy(
    charge?.version || ''
  );

  const onOpenChange = (open: boolean) => {
    if (!open) {
      dismiss();
    }
  };

  return (
    <Dialog defaultOpen modal onOpenChange={onOpenChange} className="w-[500px]">
      <div className="flex flex-col space-y-2">
        <span className="text-lg font-bold">
          About {isTalk ? 'Talk' : 'Groups'}
        </span>
        <span className="text-sm text-gray-500">{charge?.info}</span>
        <div className="flex flex-row items-center text-sm">
          <span className="font-bold text-gray-500">Version:</span>
          <code className="ml-1">{charge?.version}</code>
          <IconButton
            label="Copy Version"
            icon={
              didCopyVersion ? (
                <CheckIcon className="h-6 w-6 text-gray-400" />
              ) : (
                <CopyIcon className="h-6 w-6 text-gray-400" />
              )
            }
            action={doCopyVersion}
          />
        </div>
        <div className="flex flex-row items-center text-sm">
          <div className="flex flex-row items-end">
            <span className="font-bold text-gray-500">Hash:</span>
            <code className="ml-2 break-all">{pike?.hash}</code>
          </div>
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
            label="Copy Source"
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
    </Dialog>
  );
}

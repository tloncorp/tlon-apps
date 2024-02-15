import IconButton from '@/components/IconButton';
import CheckIcon from '@/components/icons/CheckIcon';
import CopyIcon from '@/components/icons/CopyIcon';
import { useIsMobile } from '@/logic/useMedia';
import { useCopy } from '@/logic/utils';
import { useCharge } from '@/state/docket';
import { usePike } from '@/state/kiln';

export default function About() {
  const isMobile = useIsMobile();
  const pike = usePike('groups');
  const charge = useCharge('groups');
  const { didCopy: didCopyHash, doCopy: doCopyHash } = useCopy(
    pike?.hash || ''
  );
  const { didCopy: didCopyShip, doCopy: doCopyShip } = useCopy(
    pike?.sync?.ship || ''
  );
  const { didCopy: didCopyVersion, doCopy: doCopyVersion } = useCopy(
    charge?.version || ''
  );

  return (
    <div className="flex flex-col space-y-8 text-[17px] leading-[22px]">
      {!isMobile && <span className="text-lg font-bold">About Tlon</span>}
      <span className="px-2 text-gray-500">{charge?.info}</span>
      <div className="grid grid-cols-3 gap-y-2 rounded-xl bg-gray-50 p-6">
        <span className="flex items-center text-lg text-gray-400">Version</span>
        <div className="col-span-2 -ml-6 flex items-center">
          <span className="flex items-center">{charge?.version}</span>
          <IconButton
            label="Copy Version"
            icon={
              didCopyVersion ? (
                <CheckIcon className="h-6 w-6 text-gray-300" />
              ) : (
                <CopyIcon className="h-6 w-6 text-gray-300" />
              )
            }
            action={doCopyVersion}
          />
        </div>
        <span className="flex items-center text-lg text-gray-400">Source</span>
        <div className="col-span-2 -ml-6 flex items-center">
          <span className="flex items-center break-words">
            {pike?.sync?.ship}
          </span>
          <IconButton
            label="Copy Source"
            icon={
              didCopyShip ? (
                <CheckIcon className="h-6 w-6 text-gray-300" />
              ) : (
                <CopyIcon className="h-6 w-6 text-gray-300" />
              )
            }
            action={doCopyShip}
          />
        </div>
        <span className="flex items-center text-lg text-gray-400">Hash</span>
        <div className="col-span-2 -ml-6 flex items-center">
          <span className="flex items-center break-all">{pike?.hash}</span>
          <IconButton
            label="Copy Hash"
            icon={
              didCopyHash ? (
                <CheckIcon className="h-6 w-6 text-gray-300" />
              ) : (
                <CopyIcon className="h-6 w-6 text-gray-300" />
              )
            }
            action={doCopyHash}
          />
        </div>
      </div>
    </div>
  );
}

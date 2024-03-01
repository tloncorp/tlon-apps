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
    <div className="card">
      <p className="mb-4 leading-5 text-gray-800">{charge?.info}</p>
      <div className="grid grid-cols-3 gap-y-2 rounded-xl border-2 border-gray-50 p-4">
        <span className="flex items-center">
          Version{' '}
          <IconButton
            label="Copy Version"
            icon={
              didCopyVersion ? (
                <CheckIcon className="h-4 w-4 text-gray-300" />
              ) : (
                <CopyIcon className="h-4 w-4 text-gray-300" />
              )
            }
            action={doCopyVersion}
          />
        </span>
        <div className="col-span-2 -ml-6 flex items-center">
          <span className="flex items-center">{charge?.version}</span>
        </div>
        <span className="flex items-center">
          Source{' '}
          <IconButton
            label="Copy Source"
            icon={
              didCopyShip ? (
                <CheckIcon className="h-4 w-4 text-gray-300" />
              ) : (
                <CopyIcon className="h-4 w-4 text-gray-300" />
              )
            }
            action={doCopyShip}
          />
        </span>
        <div className="col-span-2 -ml-6 flex items-center">
          <span className="flex items-center break-words">
            {pike?.sync?.ship}
          </span>
        </div>
        <span className="flex items-center">
          Hash{' '}
          <IconButton
            label="Copy Hash"
            icon={
              didCopyHash ? (
                <CheckIcon className="h-4 w-4 text-gray-300" />
              ) : (
                <CopyIcon className="h-4 w-4 text-gray-300" />
              )
            }
            action={doCopyHash}
          />
        </span>
        <div className="col-span-2 -ml-6 flex items-center">
          <span className="flex items-center break-all">{pike?.hash}</span>
        </div>
      </div>
    </div>
  );
}

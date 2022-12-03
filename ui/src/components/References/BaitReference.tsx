import { useBait } from '@/state/chat';
// eslint-disable-next-line import/no-cycle
import WritReference from './WritReference';

interface BaitReferenceProps {
  old: string;
  flag: string;
  where: string;
  isScrolling: boolean;
}

export default function BaitReference({
  old,
  flag,
  where,
  isScrolling,
}: BaitReferenceProps) {
  const bait = useBait(old, flag, where);
  if (!bait) {
    return (
      <div className="writ-inline-block group">
        {`exists: ${bait}`} {old} {flag} {where}
      </div>
    );
  }

  if (bait.exists) {
    return (
      <WritReference
        chFlag={''}
        nest={''}
        idWrit={''}
        isScrolling={isScrolling}
      />
    );
  }
  return (
    <div className="writ-inline-block group">
      {`exists: ${bait}`} {old} {flag} {where}
    </div>
  );
}

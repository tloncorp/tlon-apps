import {
  useBait
} from '@/state/chat';
// eslint-disable-next-line import/no-cycle
import WritReference from './WritReference';

export default function BaitReference({
  old,
  flag,
  where,
}: {
  old: string;
  flag: string;
  where: string;
}) {
  const bait = useBait(old, flag, where);
  if (!bait) {
    return (
    <div className="writ-inline-block group">
      {`exists: ${bait}`} {old} {flag} {where}
    </div>
    );
  }

  if (bait.exists !== false) {
    return <WritReference chFlag={''} nest={''} idWrit={''} />;

  }
  return (
    <div className="writ-inline-block group">
      {`exists: ${bait}`} {old} {flag} {where}
    </div>
  );
}

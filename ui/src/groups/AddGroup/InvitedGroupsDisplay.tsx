import GroupReference from '@/components/References/GroupReference';
import { usePendingGangsWithoutClaim } from '@/state/groups';

export default function InvitedGroupsDisplay({
  selectFlag,
}: {
  selectFlag: (flag: string) => void;
}) {
  const pendingGangs = usePendingGangsWithoutClaim();
  return (
    <div className="h-full">
      <h3 className="mb-4 text-lg font-bold">Pending Invites</h3>
      <div className="h-5/6 overflow-auto">
        {Object.keys(pendingGangs).map((flag, index) => (
          <div className="p-1">
            <GroupReference
              key={index}
              flag={flag}
              customOnClick={selectFlag}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

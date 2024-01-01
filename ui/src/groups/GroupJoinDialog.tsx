import { useState } from 'react';
import ob from 'urbit-ob';
import ShipSelector, { ShipOption } from '@/components/ShipSelector';
import WidgetDrawer from '@/components/WidgetDrawer';
import { useDismissNavigate } from '@/logic/routing';
import { hasKeys, preSig, whomIsFlag } from '@/logic/utils';
import { useGangs, useGroupIndex } from '@/state/groups';
import type { Gangs } from '@/types/groups';
import GroupJoinList from './GroupJoinList';

export default function GroupJoinDialog() {
  const dismiss = useDismissNavigate();
  const [selectedShips, setSelectedShips] = useState<ShipOption[]>([]);
  const [ship, name] = selectedShips[0]?.value.split('/') ?? [];
  const { groupIndex, fetchStatus, refetch } = useGroupIndex(ship || '');
  const existingGangs = useGangs();

  /**
   *  Search results for render:
   *
   *  - Filter out index results for gangs with invites, since they will be
   *    displayed in the Pending Invites section below.
   *  - Only show Public and Private groups, unless already a member of a ship's
   *    Secret group
   * */
  const indexedGangs = groupIndex
    ? Object.entries(groupIndex)
        .filter(([flag, preview]) => {
          if (flag in existingGangs) {
            // Bucket invites separately (in Pending Invites section)
            if (existingGangs[flag].invite) {
              return false;
            }
            // Show group if already a member
            return true;
          }

          // Hide secret gangs
          return !('afar' in preview.cordon);
        })
        .reduce(
          (memo, [flag, preview]) => ({
            ...memo,
            [flag]: {
              preview,
              invite: null,
              claim: flag in existingGangs ? existingGangs[flag].claim : null,
            },
          }),
          {} as Gangs
        )
    : null;

  const flag = name ? preSig(`${ship}/${name}`) : ship ? preSig(ship) : '';
  const gangToDisplay = name ? indexedGangs?.[flag] : null;
  // If needed group found - show it, otherwise show all groups
  const gangsToDisplay = gangToDisplay
    ? { [flag]: gangToDisplay }
    : indexedGangs;
  const hasResults = gangsToDisplay && hasKeys(gangsToDisplay);

  // Allow selecting a ship name or invite URL (i.e., flag) in ShipSelector
  const isValidNewOption = (val: string) =>
    val ? ob.isValidPatp(preSig(val)) || whomIsFlag(val) : false;

  return (
    <WidgetDrawer
      onOpenChange={(o) => !o && dismiss()}
      className="px-6 py-12"
      open
    >
      <h1 className="text-center text-[17px] font-medium">Join a Group</h1>
      <div className="mt-6 space-y-4 text-gray-400">
        <label htmlFor="flag">
          Join existing groups with a host&apos;s name, Urbit ID, or a group
          invite shortcode.
        </label>
        <ShipSelector
          ships={selectedShips}
          setShips={setSelectedShips}
          isMulti={false}
          isClearable={true}
          isLoading={fetchStatus === 'fetching'}
          hasPrompt={false}
          placeholder="Host name or group shortcode"
          isValidNewOption={isValidNewOption}
        />
      </div>
      {hasResults ? (
        <div className="mt-4 max-h-[60vh] overflow-y-auto">
          <GroupJoinList gangs={gangsToDisplay} />
        </div>
      ) : null}
    </WidgetDrawer>
  );
}

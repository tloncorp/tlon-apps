import { getSectTitle } from '@/logic/utils';
import { useGroup, useGroupFlag, useVessel } from '@/state/groups';
import * as Tooltip from '@radix-ui/react-tooltip';
import _ from 'lodash';

export default function RoleBadges(props: { ship: string; inList?: boolean }) {
  const { ship, inList } = props;
  const flag = useGroupFlag();
  const group = useGroup(flag);
  const { sects } = useVessel(flag, ship);
  const displaySects = _.pull(sects, 'member');

  if (group && sects.length) {
    if (displaySects.length >= 3) {
      return (
        <Tooltip.Root>
          <Tooltip.Trigger asChild>
            <div className="relative shrink-0 cursor-pointer rounded-full bg-gray-100 px-1.5 py-0.5 text-xs font-medium">
              {displaySects.length}
              <span className="sr-only">Roles</span>
            </div>
          </Tooltip.Trigger>
          <Tooltip.Portal>
            <Tooltip.Content asChild>
              <div className="z-50">
                <div className="z-[100] w-fit cursor-none rounded bg-gray-400 px-4 py-2">
                  <label className="whitespace-nowrap font-semibold text-white">
                    {displaySects.map((sect) => {
                      if (sect !== 'member') {
                        return (
                          <div key={sect} className="mb-2">
                            {getSectTitle(group.cabals, sect)}
                          </div>
                        );
                      }
                      return null;
                    })}
                  </label>
                </div>
                <Tooltip.Arrow asChild>
                  <svg
                    width="17"
                    height="8"
                    viewBox="0 0 17 8"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M16.5 0L0.5 0L7.08579 6.58579C7.86684 7.36684 9.13316 7.36684 9.91421 6.58579L16.5 0Z"
                      className="fill-gray-400"
                    />
                  </svg>
                </Tooltip.Arrow>
              </div>
            </Tooltip.Content>
          </Tooltip.Portal>
        </Tooltip.Root>
      );
    }
    return (
      <div className="flex items-center space-x-1 overflow-auto group-two-hover:hidden">
        {displaySects.map((sect) => {
          if (sect !== 'member') {
            return (
              <span
                key={sect}
                className={
                  inList
                    ? 'mt-1 rounded-[100px] bg-gray-50 px-2 py-[7px] text-sm font-normal text-gray-400'
                    : 'shrink-0 rounded-full bg-gray-100 px-1.5 py-0.5 text-xs font-medium'
                }
              >
                {getSectTitle(group.cabals, sect)}
              </span>
            );
          }
          return null;
        })}
      </div>
    );
  }

  return null;
}

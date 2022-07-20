import { debounce } from 'lodash';
import React, {
  ChangeEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useLocation, useNavigate, useParams } from 'react-router';
import MagnifyingGlass16Icon from '@/components/icons/MagnifyingGlass16Icon';
import { useGroupState, usePendingInvites } from '@/state/groups';
import { whomIsFlag } from '@/logic/utils';
import { ModalLocationState } from '@/logic/routing';
import GroupJoinList from './GroupJoinList';

type LocationState = ModalLocationState | null;

export default function FindGroups() {
  const { ship, name } = useParams<{ ship: string; name: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const query = ship && ship + (name ? `/${name}` : '');
  const [foundGangs, setFoundGangs] = useState<string[]>([]);
  const [rawInput, setRawInput] = useState(query || '');
  const pendingInvites = usePendingInvites();

  const searchGroups = useCallback(async (q: string) => {
    const isFlag = whomIsFlag(q);

    if (isFlag) {
      await useGroupState.getState().search(q);
      if (q in useGroupState.getState().gangs) {
        setFoundGangs([q]);
      }
    }
  }, []);

  useEffect(() => {
    if (!query) {
      return;
    }

    searchGroups(query);
  }, [query, searchGroups]);

  const onUpdate = useMemo(
    () =>
      debounce(async (value: string) => {
        if (!whomIsFlag(value)) {
          return;
        }
        navigate(`/groups/find/${value.replace('web+urbitgraph://', '')}`);
      }, 500),
    [navigate]
  );

  useEffect(() => {
    const state = location.state as LocationState;
    if (state && 'backgroundLocation' in state) {
      // prevent navigation away from an open Join Group Modal
      return;
    }
    if (rawInput) {
      onUpdate(rawInput);
    }
  }, [rawInput, onUpdate, location.state]);

  const onChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const { value } = event.target;
    setRawInput(value);
  }, []);

  return (
    <div className="flex grow bg-gray-50">
      <div className="w-full max-w-3xl p-4">
        <section className="card mb-4 space-y-8 p-8">
          <h1 className="text-lg font-bold">Find Groups</h1>
          <div>
            <label htmlFor="flag" className="mb-1.5 block font-semibold">
              Join Groups via Invite Link
            </label>
            <div className="relative flex items-center">
              <MagnifyingGlass16Icon className="absolute left-2 h-4 w-4" />
              <input
                value={rawInput}
                name="flag"
                className="input w-full pl-8"
                placeholder="e.g. ~bitbet-bolbel/urbit-community"
                onChange={onChange}
              />
            </div>
          </div>
        </section>
        {query ? (
          <section className="card mb-4 space-y-8 p-8">
            <h1 className="text-lg font-bold">Results</h1>
            {foundGangs.length > 0 ? (
              <GroupJoinList gangs={foundGangs} />
            ) : (
              <p>No groups found for &apos;{query}&apos;</p>
            )}
          </section>
        ) : null}
        {pendingInvites.length > 0 ? (
          <section className="card mb-4 space-y-8 p-8">
            <h1 className="text-lg font-bold">Pending Invites</h1>
            <GroupJoinList gangs={pendingInvites} />
          </section>
        ) : null}
      </div>
    </div>
  );
}

import { debounce } from 'lodash';
import React, {
  ChangeEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useNavigate, useParams } from 'react-router';
import MagnifyingGlass16Icon from '@/components/icons/MagnifyingGlass16Icon';
import { useGroupList, useGroupState } from '@/state/groups';
import { whomIsFlag } from '@/logic/utils';
import GroupJoinList from './GroupJoinList';

export default function FindGroups() {
  const { ship, name } = useParams<{ ship: string; name: string }>();
  const navigate = useNavigate();
  const query = ship && ship + (name ? `/${name}` : '');
  const [gangs, setGangs] = useState<string[]>([]);
  const [rawInput, setRawInput] = useState(query || '');

  useEffect(() => {
    if (!query) {
      return;
    }

    const isFlag = whomIsFlag(query);

    if (isFlag) {
      useGroupState.getState().search(query);
      setGangs([query]);
    }
  }, [query]);

  const onUpdate = useMemo(
    () =>
      debounce(async (value: string) => {
        navigate(`/groups/find/${value.replace('web+urbitgraph://', '')}`);
      }, 500),
    [navigate]
  );

  useEffect(() => {
    if (rawInput) {
      onUpdate(rawInput);
    }
  }, [rawInput, onUpdate]);

  const onChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const { value } = event.target;
    setRawInput(value);
  }, []);

  return (
    <div className="flex grow bg-gray-50">
      <div className="w-full max-w-3xl p-4">
        <section className="card space-y-8 p-8">
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
          <GroupJoinList size="small" gangs={gangs} />
        </section>
      </div>
    </div>
  );
}

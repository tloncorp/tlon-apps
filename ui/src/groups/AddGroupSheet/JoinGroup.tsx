import { useRef, useState } from 'react';
import cn from 'classnames';
import { isValidPatp } from 'urbit-ob';
import { preSig, whomIsFlag } from '@/logic/utils';
import { useGangs, useGroupIndex, useGroups } from '@/state/groups';
import { Gangs } from '@/types/groups';
import LargeTextInput from '@/components/FullsizeTextInput';
import CaretLeftIcon from '@/components/icons/CaretLeftIcon';
import { ShipGroupsDisplay, ShipSearchResultsDisplay } from './SearchResults';
import { MobileGroupPreview } from '../Join/JoinGroupModal';
import useShipSearch from './useShipSearch';

function JoinSelector(props: {
  selectGroup: (flag: string) => void;
  back: () => void;
  className?: string;
}) {
  const [selected, setSelected] = useState('');
  const [input, setInput] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const inputIsShortcode = input.includes('/');
  const [rawShip, name] = input?.split('/') ?? [];
  const potentialShip =
    rawShip && isValidPatp(preSig(rawShip)) ? preSig(rawShip) : '';
  const potentialFlag =
    potentialShip && inputIsShortcode ? preSig(`${potentialShip}/${name}`) : '';

  const existingGangs = useGangs();
  const groups = useGroups();
  const { groupIndex, fetchStatus } = useGroupIndex(
    selected || potentialShip || ''
  );
  const shipSearchResults = useShipSearch(input);

  const indexedGangs = groupIndex
    ? Object.entries(groupIndex)
        .filter(([flag, preview]) => {
          // Hide secret gangs
          if ('afar' in preview.cordon) {
            return false;
          }

          // if searching for shortcode, filter out gangs that don't match
          if (inputIsShortcode) {
            return flag.startsWith(potentialFlag);
          }

          return true;
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

  // only consider search results where theres something meaningful to go off of
  const validQuery = input.length && input !== '~';

  const showShipSearch = !selected && !inputIsShortcode && validQuery;
  const showGroups = selected || inputIsShortcode;

  const onChange = (newInput: string) => {
    if (whomIsFlag(newInput) && (existingGangs[newInput] || groups[newInput])) {
      // if input matches a shortcode we already have, go to it immediately
      setInput('');
      props.selectGroup(newInput);
    } else {
      setInput(newInput);
    }
  };

  const select = (patp: string, nickname?: string) => {
    setInput(`Groups hosted by ${nickname || patp}`);
    setSelected(patp);
    inputRef.current?.blur();
  };

  const deselect = () => {
    setInput(selected);
    setSelected('');
    inputRef.current?.focus();
  };

  return (
    <div className={cn('flex flex-col', props.className)}>
      <div className="mb-4 flex w-full flex-shrink items-center justify-between">
        <div
          className="flex h-6 w-6 items-center justify-center "
          onClick={() => props.back()}
        >
          <CaretLeftIcon className="relative right-1 h-6 w-6" />
        </div>
        <h3 className="text-[17px]">Join Group</h3>
        <div className="invisible h-6 w-6" />
      </div>

      <div className="mt-6 flex-shrink space-y-4 text-gray-400">
        <label htmlFor="flag">
          Search for existing groups with a host&apos;s name, Urbit ID, or a
          group invite shortcode.
        </label>
        <div>
          <LargeTextInput
            disableGrammar
            ref={inputRef}
            autoFocus
            onFocus={() => deselect()}
            spellCheck="false"
            placeholder="Host name or group shortcode"
            value={input}
            onChange={(e) => onChange(e.target.value)}
          />
        </div>
      </div>

      {showShipSearch ? (
        <ShipSearchResultsDisplay
          searchResults={shipSearchResults}
          select={select}
        />
      ) : null}
      {showGroups ? (
        <ShipGroupsDisplay
          gangs={indexedGangs || {}}
          loading={fetchStatus === 'fetching'}
          selectGroup={props.selectGroup}
        />
      ) : null}
      {!showShipSearch && !showGroups && (
        <div className="mt-5 h-[250px] w-full" />
      )}
    </div>
  );
}

function PreviewGroup(props: {
  flag: string;
  back: () => void;
  className?: string;
}) {
  if (!props.flag) {
    return null;
  }

  return (
    <div className={cn('flex h-[50vh] flex-col', props.className)}>
      <div
        className="flex h-6 w-6 items-center justify-center"
        onClick={() => props.back()}
      >
        <CaretLeftIcon className="relative right-1 h-6 w-6" />
      </div>
      <MobileGroupPreview flag={props.flag} />
    </div>
  );
}

export default function JoinGroup({ back }: { back: () => void }) {
  const [flag, setFlag] = useState('');

  return (
    <>
      <JoinSelector
        className={flag ? 'hidden' : ''}
        back={back}
        selectGroup={(f) => setFlag(f)}
      />
      <PreviewGroup
        className={flag ? '' : 'hidden'}
        flag={flag}
        back={() => setFlag('')}
      />
    </>
  );
}

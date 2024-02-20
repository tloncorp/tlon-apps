import { useRef, useState } from 'react';
import cn from 'classnames';
import { useDismissNavigate } from '@/logic/routing';
import { whomIsFlag } from '@/logic/utils';
import ShipSelector, { ShipOption } from '@/components/ShipSelector';
import Dialog from '@/components/Dialog';
import { DialogTitle } from '@radix-ui/react-dialog';
import { useGangs, useGroups } from '@/state/groups';
import LargeTextInput from '@/components/FullsizeTextInput';
import CaretLeftIcon from '@/components/icons/CaretLeftIcon';
import { ShipGroupsDisplay, ShipSearchResultsDisplay } from './SearchResults';
import { MobileGroupPreview } from '../Join/GroupPreview';
import useShipSearch from './useShipSearch';
import useGroupSearch from './useGroupSearch';
import InvitedGroupsDisplay from './InvitedGroupsDisplay';

export default function JoinGroupSheet({
  back,
  onOpenChange,
}: {
  back: () => void;
  onOpenChange: (open: boolean) => void;
}) {
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
        close={() => onOpenChange(false)}
      />
    </>
  );
}

export function JoinGroupDialog() {
  const [open, setOpen] = useState(true);
  const [ship, setShip] = useState<ShipOption | null>(null);
  const [flag, setFlag] = useState<string | null>(null);

  const dismiss = useDismissNavigate();
  const {
    flags: resultFlags,
    loading,
    hostMayBeOffline,
  } = useGroupSearch(ship?.value ?? '');

  const selectShip = (ships: ShipOption[]) => {
    if (ships.length > 0) {
      setShip(ships[0]);
    } else {
      setShip(null);
    }
  };

  const onOpenChange = (newOpen: boolean) => {
    // Any click when the nested modal is open will count as a click
    // outside of the root mobile, so we manually keep it open
    if (flag) return;

    if (!newOpen) {
      setOpen(false);
      dismiss();
    }
  };

  return (
    <Dialog open={open} modal onOpenChange={onOpenChange}>
      <div className="h-[500px] w-[600px] outline-none">
        <DialogTitle className="text-lg font-bold">Join a Group</DialogTitle>
        <div className="mt-8">
          <label>
            Search for existing groups with a host&apos;s name, Urbit ID, or a
            group invite shortcode.
          </label>
          <ShipSelector
            containerClassName="mt-4"
            isMulti={false}
            isClearable={true}
            hasPrompt={false}
            ships={ship ? [ship] : []}
            setShips={selectShip}
            menuPlacement="bottom"
            placeholder="e.g. ~nibset-napwyn/tlon"
          />
        </div>

        <div className="mt-6">
          {ship ? (
            <>
              <p className="text-gray-400">
                Groups hosted by{' '}
                <span className="text-black">{ship.label}</span>:
              </p>
              <div className="h-[320px]">
                <ShipGroupsDisplay
                  autoHeight={true}
                  flags={resultFlags}
                  loading={loading}
                  size="desktop"
                  hostMayBeOffline={hostMayBeOffline}
                  selectGroup={(selectedFlag) => setFlag(selectedFlag)}
                />
              </div>
            </>
          ) : (
            <div className="mt-16 h-[300px]">
              <InvitedGroupsDisplay selectFlag={setFlag} />
            </div>
          )}
        </div>
      </div>

      <Dialog
        className="min-w-[400px] max-w-md"
        open={flag !== null}
        onOpenChange={(newOpen) => (newOpen ? null : setFlag(null))}
      >
        <MobileGroupPreview flag={flag ?? ''} closeOnJoin={() => dismiss()} />
      </Dialog>
    </Dialog>
  );
}

function JoinSelector(props: {
  selectGroup: (flag: string) => void;
  back: () => void;
  className?: string;
}) {
  const existingGangs = useGangs();
  const groups = useGroups();
  const [selected, setSelected] = useState('');
  const [input, setInput] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const shipSearchResults = useShipSearch(input);
  const {
    flags: resultFlags,
    loading,
    hostMayBeOffline,
    isValidShortcode,
  } = useGroupSearch(selected || input);

  // only consider search results where theres something meaningful to go off of
  const validQuery = input.length && input !== '~';

  const showShipSearch = !selected && !isValidShortcode && validQuery;
  const showGroups = selected || isValidShortcode;

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
          hostMayBeOffline={hostMayBeOffline}
          flags={resultFlags}
          loading={loading}
          selectGroup={props.selectGroup}
        />
      ) : null}
      {!showShipSearch && !showGroups && (
        <div className="mt-3 h-[200px] w-full" />
      )}
    </div>
  );
}

function PreviewGroup(props: {
  flag: string;
  back: () => void;
  close: () => void;
  className?: string;
}) {
  if (!props.flag) {
    return null;
  }

  return (
    <div className={cn('flex h-[50vh] flex-col', props.className)}>
      <div
        className="flex h-6 w-6 cursor-pointer items-center justify-center"
        onClick={() => props.back()}
      >
        <CaretLeftIcon className="relative right-1 h-6 w-6" />
      </div>
      <MobileGroupPreview flag={props.flag} closeOnJoin={props.close} />
    </div>
  );
}

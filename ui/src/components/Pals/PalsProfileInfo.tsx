import React, { useCallback, useEffect, useState } from 'react';
import usePalsState from '@/state/pals';
import useDocketState from '@/state/docket';
import LoadingSpinner from '../LoadingSpinner/LoadingSpinner';
import ModalOverlay from './ModalOverlay';
import XIcon from '../icons/XIcon';
import AddPersonIcon from '../icons/AddPersonIcon';

export const PALS_HOST = '~paldev';
export const PALS_APP = 'pals';

export interface TagFormSchema {
  tag: string;
}

interface PalsProfileInfoProps {
  ship: string;
}
export default function PalsProfileInfo({
  ship
}: PalsProfileInfoProps) {
  const { addAlly, requestTreaty, installDocket } = useDocketState();
  const { installed, loading, pals, mutuals, fetchPals, addPal, removePal, set: setPalsState } = usePalsState();
  const [isInstalling, setIsInstalling] = useState(false);
  const [showInstallModal, setShowInstallModal] = useState(false);
  const [tags, setTags] = useState(pals.outgoing[ship]?.lists || []);
  const [tag, setTag] = useState('');

  const isMutual = Boolean(mutuals[ship]);
  const isLeech = !isMutual && Boolean(pals.outgoing[ship]);
  const isTarget = !isMutual && Boolean(pals.incoming[ship]);

  useEffect(() => {
    fetchPals();
  }, []); // eslint-disable-line

  useEffect(() => {
    if (pals.outgoing[ship]?.lists.length) {
      setTags(pals.outgoing[ship]?.lists || []);
    }
  }, [pals.outgoing[ship]]);

  const handleSendRequest = useCallback(() => {
    if (!loading && installed) {
      addPal(ship);
    } else {
      setShowInstallModal(true);
    }
  }, [loading, installed, ship, addPal]);

  const handleInstall = useCallback(async () => {
    setIsInstalling(true);
    setShowInstallModal(false);
    try {
      await addAlly(PALS_HOST);
      await requestTreaty(PALS_HOST, PALS_APP);
      await installDocket(PALS_HOST, PALS_APP);
      setPalsState({ installed: true });
    } catch (err) {
      console.warn('PALS INSTALL ERROR:', err);
    } finally {
      setIsInstalling(false);
    }
  }, [setIsInstalling, setShowInstallModal, addAlly, requestTreaty, installDocket, setPalsState]);

  const removeTag = useCallback(async (targetTag: string) => {
    try {
      const newTags = tags.filter(t => t !== targetTag);
      await addPal(ship, newTags);
      setTags(newTags);
    } catch (e) {
      console.error(e);
    }
  }, [ship, tags, addPal]);

  const onSubmitTag = useCallback(async (e) => {
    console.log('FIRING');
    e.preventDefault();
    e.stopPropagation();
    try {
      const newTags = tags.concat([tag]);
      await addPal(ship, newTags);
      setTags(newTags);
      setTag('');
    } catch (err) {
      console.error(err);
    }
  }, [ship, tags, addPal, tag, setTag]);

  const getActionProps = () : { icon: JSX.Element | null; text: string | Element; onClick?: () => void } => {
    if (isMutual || isLeech) {
      return { icon: null, text: 'Remove Pal', onClick: () => removePal(ship) };
    // } else if (isLeech) {
    //   return { icon: 'Clock', text: 'Pals request pending' };
    }
    if (isTarget) {
      return { icon: <AddPersonIcon className='mr-2 h-4 w-4'/>, text: 'Add to pals', onClick: () => addPal(ship) };
    }

    // TODO: if %pals isn't installed, show a modal with the option to install %pals
    return { icon: <AddPersonIcon className='mr-2 h-4 w-4'/>, text: 'Add to pals', onClick: handleSendRequest };
  };

  if (showInstallModal) {
    return (
      <ModalOverlay
        className='flex h-full w-full flex-col items-center justify-center bg-transparent'
        dismiss={() => setShowInstallModal(false)}
      >
        <div className='flex flex-col items-center rounded bg-white p-1'>
          <div>You do not have <div className='text-mono'>%pals</div> installed,<br /> would you like to install it?</div>
          <div className='mt-1 flex flex-row'>
            <button className='button' onClick={() => setShowInstallModal(false)} >Cancel</button>
            <button className='button ml-2' onClick={handleInstall}>Install</button>
          </div>
        </div>
      </ModalOverlay>
    );
  }
  if (isInstalling) {
    return (
      <div className='w-4/5 cursor-pointer p-1 pl-2 hover:bg-gray-50'>
        <LoadingSpinner />
        <div className='ml-2'>Installing...</div>
      </div>
    );
  }

  const { icon, text, onClick } = getActionProps();

  return (
    <>
      {!((isMutual || isLeech) && tags.length < 4) && (
        <button className='button my-2 cursor-pointer p-2' onClick={onClick}>
          {icon}
          {text}
        </button>
      )}
      
      {tags.length > 0 && (
        <div className='my-1 flex flex-row flex-wrap'>
          {tags.map(t => (
            <div key={t}
              className='m-1 flex flex-row cursor-pointer rounded bg-gray-50 px-2 py-1 items-center'
              onClick={() => removeTag(t)}
            >
              {t}
              <XIcon className='ml-1 w-3 h-3' />
            </div>
          ))}
        </div>
      )}
      {((isMutual || isLeech) && tags.length < 4) && (
        <div className='mt-1'>
          <form onSubmit={onSubmitTag}>
            <div className='flex shrink-0 flex-col justify-between'>
              <input
                className='max-w-100 h-6 w-40 rounded px-2'
                style={{ border: '1px solid gray' }}
                placeholder="Type pals tag here"
                value={tag}
                onChange={(e) => setTag(e.target.value)}
                maxLength={20}
              />
              <div className='flex flex-row'>
                <button className='button mt-2 w-30' type="submit">Add Tag</button>
                <button className='button mt-2 ml-2 w-30 cursor-pointer' onClick={onClick}>
                  {icon}
                  {text}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}
    </>
  );
}

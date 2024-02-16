import { getAppHref, getAppName } from '@/logic/utils';
import useDocketState, { ChargeWithDesk, useTreaty } from '@/state/docket';
import { Pike, Treaty, chadIsRunning } from '@urbit/api';
import cn from 'classnames';
import clipboardCopy from 'clipboard-copy';
import React, { useCallback, useState } from 'react';

import Dialog, { DialogClose, DialogContent, DialogTrigger } from '../Dialog';
import { Button, PillButton } from './Button';
import DocketHeader from './DocketHeader';
import PikeMeta from './PikeMeta';
import Spinner from './Spinner';
import TreatyMeta from './TreatyMeta';
import { addRecentApp } from './grid';

type InstallStatus = 'uninstalled' | 'installing' | 'installed';

type App = ChargeWithDesk | Treaty;
interface AppInfoProps {
  docket: App;
  pike?: Pike;
  className?: string;
}

function getInstallStatus(docket: App): InstallStatus {
  if (!('chad' in docket)) {
    return 'uninstalled';
  }
  if (chadIsRunning(docket.chad)) {
    return 'installed';
  }
  if ('install' in docket.chad) {
    return 'installing';
  }
  return 'uninstalled';
}

function getRemoteDesk(docket: App, pike?: Pike) {
  if (pike && pike.sync) {
    return [pike.sync.ship, pike.sync.desk];
  }
  if ('chad' in docket) {
    return ['', docket.desk];
  }
  const { ship, desk } = docket;
  return [ship, desk];
}

export default function AppInfo({ docket, pike, className }: AppInfoProps) {
  const installStatus = getInstallStatus(docket);
  const [ship, desk] = getRemoteDesk(docket, pike);
  const publisher = pike?.sync?.ship ?? ship;
  const [copied, setCopied] = useState(false);
  const treaty = useTreaty(ship, desk);

  const installApp = async () => {
    if (installStatus === 'installed') {
      return;
    }
    await useDocketState.getState().installDocket(ship, desk);
  };

  const copyApp = useCallback(() => {
    setCopied(true);
    clipboardCopy(`/1/desk/${publisher}/${desk}`);

    setTimeout(() => {
      setCopied(false);
    }, 1250);
  }, [publisher, desk]);

  const installing = installStatus === 'installing';

  if (!docket) {
    // TODO: maybe replace spinner with skeletons
    return (
      <div className="dialog-inner-container flex justify-center text-black">
        <Spinner className="h-10 w-10" />
      </div>
    );
  }

  return (
    <div className={cn('text-black', className)}>
      <DocketHeader docket={docket}>
        <div className="col-span-2 flex items-center space-x-4 md:col-span-1">
          {installStatus === 'installed' && (
            <PillButton
              variant="alt-primary"
              as="a"
              href={getAppHref(docket.href)}
              target="_blank"
              rel="noreferrer"
              onClick={() => addRecentApp(docket.desk)}
            >
              Open App
            </PillButton>
          )}
          {installStatus !== 'installed' && (
            <Dialog>
              <DialogTrigger asChild>
                <PillButton variant="alt-primary" disabled={installing}>
                  {installing ? (
                    <>
                      <Spinner />
                      <span className="sr-only">Installing...</span>
                    </>
                  ) : (
                    'Get App'
                  )}
                </PillButton>
              </DialogTrigger>
              <DialogContent
                close="none"
                className="space-y-6"
                containerClass="w-full max-w-md"
              >
                <h2 className="h4">
                  Install &ldquo;{getAppName(docket)}&rdquo;
                </h2>
                <p className="pr-6 tracking-tight">
                  This application will be able to view and interact with the
                  contents of your Urbit. Only install if you trust the
                  developer.
                </p>
                <div className="flex space-x-6">
                  <DialogClose asChild>
                    <Button variant="secondary">Cancel</Button>
                  </DialogClose>
                  <DialogClose asChild onClick={installApp}>
                    <Button onClick={installApp}>
                      Get &ldquo;{getAppName(docket)}&rdquo;
                    </Button>
                  </DialogClose>
                </div>
              </DialogContent>
            </Dialog>
          )}
          <PillButton variant="alt-secondary" onClick={copyApp}>
            {!copied && 'Copy App Link'}
            {copied && 'copied!'}
          </PillButton>
        </div>
      </DocketHeader>
      <div className="space-y-6">
        {pike ? (
          <>
            <hr className="-mx-5 border-gray-50 sm:-mx-8" />
            <PikeMeta pike={pike} />
          </>
        ) : null}
        {!treaty ? null : (
          <>
            <hr className="-mx-5 border-gray-50 sm:-mx-8" />
            <TreatyMeta treaty={treaty} />
          </>
        )}
      </div>
    </div>
  );
}

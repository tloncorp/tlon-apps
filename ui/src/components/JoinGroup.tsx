import React from 'react';
import { useGang, useGroupState } from '../state/groups';

export function JoinGroup(props: { flag: string; }) {
  const { flag } = props;
  const gang = useGang(flag);
  const onJoin = () => {
    useGroupState.getState().join(flag, false);
  };
  const onRequest = () => {
    console.warn('unimplemented');
  };
  const cordon = gang.preview?.cordon
  if(!cordon) {
    return null;
  }
  return (
    <div className="flex flex-col space-y-3 rounded border p-2">
      {'open' in cordon ? (
        <button
          type="button"
          onClick={onJoin}
          className="rounded bg-blue p-2 text-white"
        >
          Join Group
        </button>
      ) : 'shut' in cordon ? (
        <button
          type="button"
          onClick={onRequest}
          className="rounded bg-blue p-2 text-white"
        >
          Request to Join
        </button>
      ) : (
        <>
          <p>{cordon.afar.desc}</p>
          <a href="" target="">
            Authenticate with {cordon.afar.app}
          </a>
        </>
      )}
    </div>
  );
}

import { createDevLogger } from '@tloncorp/shared/dist';
import * as store from '@tloncorp/shared/dist/store';
import { useCallback, useEffect, useRef, useState } from 'react';

import { useLureMetadata } from '../contexts/branch';
import { useShip } from '../contexts/ship';
import { configureClient } from '../lib/api';
import { NodeBootPhase } from '../lib/bootHelpers';
import BootHelpers from '../lib/bootHelpers';
import { getShipFromCookie } from '../utils/ship';

const HANDLE_INVITES_TIMEOUT = 1000 * 30;

const logger = createDevLogger('boot sequence', true);

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/*
  Handles making sure hosted nodes are ready to go during signup. Two main components:
    
    runBootPhase — executes a single step of the boot process, returns the next step in the sequence
    runBootSequence — repeatedly executes runBootPhase until the sequence is complete

  The hook remains idle until passed a hosted user. Gives up after HANDLE_INVITES_TIMEOUT seconds if
  we're stuck processing invites, but the node is otherwise ready. Exposes the current boot phase to
  the caller.
*/
export function useBootSequence(hostingUser: { id: string } | null) {
  const { setShip } = useShip();
  const connectionStatus = store.useConnectionStatus();
  const lureMeta = useLureMetadata();

  const [bootPhase, setBootPhase] = useState(NodeBootPhase.IDLE);
  const [reservedNodeId, setReservedNodeId] = useState<string | null>(null);

  const isRunningRef = useRef(false);
  const lastRunPhaseRef = useRef(bootPhase);
  const lastRunErrored = useRef(false);
  const sequenceStartTimeRef = useRef<number>(0);

  // detect when we're ready to start the sequence, kick things off
  // by advancing past IDLE
  useEffect(() => {
    if (bootPhase === NodeBootPhase.IDLE && hostingUser?.id) {
      setBootPhase(NodeBootPhase.RESERVING);
    }
  }, [bootPhase, hostingUser]);

  const runBootPhase = useCallback(async (): Promise<NodeBootPhase> => {
    if (!hostingUser) {
      logger.log('no hosting user found, skipping');
      return bootPhase;
    }

    //
    // RESERVING: reserve a node for the hosting account, or get one if it already exists
    //
    if (bootPhase === NodeBootPhase.RESERVING) {
      const reservedNodeId = await BootHelpers.reserveNode(hostingUser.id);
      setReservedNodeId(reservedNodeId);
      logger.log(`reserved node`, reservedNodeId);
      return NodeBootPhase.BOOTING;
    }

    // you should not be able to advance past here unless reservedNodeId is set
    if (!reservedNodeId) {
      throw new Error(
        `cannot run boot phase ${bootPhase} without a reserved node`
      );
    }

    //
    // BOOTING: confirm the node has finished booting on hosting
    //
    if (bootPhase === NodeBootPhase.BOOTING) {
      const isReady = await BootHelpers.checkNodeBooted(reservedNodeId);
      if (isReady) {
        logger.log('checked hosting, node is ready');
        return NodeBootPhase.AUTHENTICATING;
      }

      logger.log('checked hosting, node still booting');
      return NodeBootPhase.BOOTING;
    }

    //
    // AUTHENTICATING: authenticate with the node itself
    //
    if (bootPhase === NodeBootPhase.AUTHENTICATING) {
      const auth = await BootHelpers.authenticateNode(reservedNodeId);
      console.log(`got auth`, auth);
      const ship = getShipFromCookie(auth.authCookie);
      console.log(`ship`, ship, auth.nodeId, auth.authCookie);

      setShip({
        ship,
        shipUrl: auth.nodeUrl,
        authCookie: auth.authCookie,
      });

      configureClient({
        shipName: auth.nodeId,
        shipUrl: auth.nodeUrl,
        onReset: () => store.syncStart(),
        onChannelReset: () => store.handleDiscontinuity(),
        onChannelStatusChange: store.handleChannelStatusChange,
      });
      store.syncStart();

      logger.log(`authenticated with node`);
      return NodeBootPhase.CONNECTING;
    }

    //
    // CONNECTING: make sure the connection is established
    //
    if (bootPhase === NodeBootPhase.CONNECTING) {
      await wait(1000);
      if (connectionStatus === 'Connected') {
        logger.log(`connection to node established`);
        const signedUpWithInvite = Boolean(lureMeta?.id);
        return signedUpWithInvite
          ? NodeBootPhase.CHECKING_FOR_INVITE
          : NodeBootPhase.READY;
      }

      logger.log(`still connecting to node`, connectionStatus);
      return NodeBootPhase.CONNECTING;
    }

    //
    // CHECKING_FOR_INVITE [optional]: if we used an invite code to signup, see if we got the invites
    //
    if (bootPhase === NodeBootPhase.CHECKING_FOR_INVITE) {
      const { invitedDm, invitedGroup } =
        await BootHelpers.getInvitedGroupAndDm(lureMeta);

      if (invitedDm && invitedGroup) {
        logger.log('confirmed node has the invites');
        return NodeBootPhase.ACCEPTING_INVITES;
      }

      logger.log('checked node for invites, not yet found');
      return NodeBootPhase.CHECKING_FOR_INVITE;
    }

    //
    // ACCEPTING_INVITES [optional]: join the invited groups
    //
    if (bootPhase === NodeBootPhase.ACCEPTING_INVITES) {
      const { invitedDm, invitedGroup, tlonTeamDM } =
        await BootHelpers.getInvitedGroupAndDm(lureMeta);

      // if we have invites, accept them
      if (tlonTeamDM && tlonTeamDM.isDmInvite) {
        logger.log(`accepting dm invitation`);
        await store.respondToDMInvite({ channel: tlonTeamDM, accept: true });
      }

      if (invitedDm && invitedDm.isDmInvite) {
        logger.log(`accepting dm invitation`);
        await store.respondToDMInvite({ channel: invitedDm, accept: true });
      }

      if (
        invitedGroup &&
        !invitedGroup.currentUserIsMember &&
        invitedGroup.haveInvite
      ) {
        logger.log('accepting group invitation');
        await store.joinGroup(invitedGroup);
      }

      // give it some time to process, then hard refresh the data
      await wait(2000);
      if (invitedGroup) {
        try {
          await store.syncGroup(invitedGroup?.id);
        } catch (e) {
          logger.error('failed to sync group?', e.body);
        }
      }
      if (invitedDm) {
        try {
          await store.syncDms();
        } catch (e) {
          logger.error('failed to sync dms?', e);
        }
      }

      // check if we successfully joined
      const {
        invitedDm: updatedDm,
        invitedGroup: updatedGroup,
        tlonTeamDM: updatedTlonTeamDm,
      } = await BootHelpers.getInvitedGroupAndDm(lureMeta);

      const dmIsGood = updatedDm && !updatedDm.isDmInvite;
      const tlonTeamIsGood = updatedTlonTeamDm && !updatedTlonTeamDm.isDmInvite;
      const groupIsGood =
        updatedGroup &&
        updatedGroup.currentUserIsMember &&
        updatedGroup.channels &&
        updatedGroup.channels.length > 0;

      if (dmIsGood && groupIsGood) {
        logger.log('successfully accepted invites');
        if (updatedTlonTeamDm) {
          store.pinItem(updatedTlonTeamDm);
        }
        return NodeBootPhase.READY;
      }

      logger.log(
        'still waiting on invites to be accepted',
        `dm: ${dmIsGood}`,
        `group: ${groupIsGood}`,
        `tlonTeam: ${tlonTeamIsGood}`
      );
      return NodeBootPhase.ACCEPTING_INVITES;
    }

    return bootPhase;
  }, [
    bootPhase,
    connectionStatus,
    hostingUser,
    lureMeta,
    reservedNodeId,
    setShip,
  ]);

  useEffect(() => {
    const runBootSequence = async () => {
      // prevent simultaneous runs
      if (isRunningRef.current) {
        return;
      }

      isRunningRef.current = true;
      if (!sequenceStartTimeRef.current) {
        sequenceStartTimeRef.current = Date.now();
      }

      try {
        // if rerunning failed step, wait before retry
        const lastRunDidNotAdvance = bootPhase === lastRunPhaseRef.current;
        if (lastRunDidNotAdvance || lastRunErrored.current) {
          await wait(3000);
        }

        lastRunPhaseRef.current = bootPhase;
        lastRunErrored.current = false;
        logger.log(`running boot sequence phase: ${bootPhase}`);

        const nextBootPhase = await runBootPhase();
        setBootPhase(nextBootPhase);
      } catch (e) {
        logger.error(`${bootPhase} errored`, e.message, e);
        lastRunErrored.current = true;
        setBootPhase(bootPhase);

        // handle
      } finally {
        isRunningRef.current = false;
      }
    };

    // if we're stuck trying to handle invites afte user finishes signing up, bail
    const beenRunningTooLong =
      Date.now() - sequenceStartTimeRef.current > HANDLE_INVITES_TIMEOUT;
    const isInOptionalPhase = [
      NodeBootPhase.ACCEPTING_INVITES,
      NodeBootPhase.CHECKING_FOR_INVITE,
    ].includes(bootPhase);
    if (isInOptionalPhase && beenRunningTooLong) {
      logger.log('timed out waiting for invites, proceeding');
      setBootPhase(NodeBootPhase.READY);
      return;
    }

    if (![NodeBootPhase.IDLE, NodeBootPhase.READY].includes(bootPhase)) {
      runBootSequence();
    }
  }, [runBootPhase, setBootPhase, bootPhase]);

  return {
    bootPhase,
  };
}

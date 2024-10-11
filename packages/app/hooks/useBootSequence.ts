import { createDevLogger } from '@tloncorp/shared/dist';
import * as store from '@tloncorp/shared/dist/store';
import { useCallback, useEffect, useRef, useState } from 'react';

import { useLureMetadata } from '../contexts/branch';
import { useShip } from '../contexts/ship';
import { configureClient } from '../lib/api';
import { NodeBootPhase } from '../lib/bootHelpers';
import BootHelpers from '../lib/bootHelpers';
import { getShipFromCookie } from '../utils/ship';
import { useConfigureUrbitClient } from './useConfigureUrbitClient';

const HANDLE_INVITES_TIMEOUT = 1000 * 30;

const logger = createDevLogger('boot sequence', true);

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

interface BootSequenceReport {
  startedAt: number;
  completedAt: number;
}

/*
  Takes a fresh hosting account and holds its hand until it has a node that's ready to transition
  to a logged in state.
  
  Two main components:  
    runBootPhase — executes a single boot step, returns the next step in the sequence
    runBootSequence — repeatedly executes runBootPhase until the sequence is complete

  The hook remains idle until passed a hosted user. Gives up after HANDLE_INVITES_TIMEOUT seconds if
  we're stuck processing invites, but the node is otherwise ready. Exposes the current boot phase to
  the caller.
*/
export function useBootSequence({
  hostingUser,
}: {
  hostingUser: { id: string } | null;
}) {
  const { setShip } = useShip();
  const connectionStatus = store.useConnectionStatus();
  const lureMeta = useLureMetadata();
  const configureUrbitClient = useConfigureUrbitClient();

  const [bootPhase, setBootPhase] = useState(NodeBootPhase.IDLE);
  const [reservedNodeId, setReservedNodeId] = useState<string | null>(null);
  const [report, setReport] = useState<BootSequenceReport | null>(null);

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
      logger.crumb('no hosting user found, skipping');
      return bootPhase;
    }

    //
    // RESERVING: reserve a node for the hosting account, or get one if it already exists
    //
    if (bootPhase === NodeBootPhase.RESERVING) {
      const reservedNodeId = await BootHelpers.reserveNode(hostingUser.id);
      setReservedNodeId(reservedNodeId);
      logger.crumb(`reserved node`, reservedNodeId);
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
        logger.crumb('checked hosting, node is ready');
        return NodeBootPhase.AUTHENTICATING;
      }

      logger.crumb('checked hosting, node still booting');
      return NodeBootPhase.BOOTING;
    }

    //
    // AUTHENTICATING: authenticate with the node itself
    //
    if (bootPhase === NodeBootPhase.AUTHENTICATING) {
      const auth = await BootHelpers.authenticateNode(reservedNodeId);
      const ship = getShipFromCookie(auth.authCookie);

      setShip({
        ship,
        shipUrl: auth.nodeUrl,
        authCookie: auth.authCookie,
        authType: 'hosted',
      });

      // configureClient({
      //   shipName: auth.nodeId,
      //   shipUrl: auth.nodeUrl,
      //   onReset: () => store.syncStart(),
      //   onChannelReset: () => store.handleDiscontinuity(),
      //   onChannelStatusChange: store.handleChannelStatusChange,
      // });
      configureUrbitClient();
      store.syncStart();

      logger.crumb(`authenticated with node`);
      return NodeBootPhase.CONNECTING;
    }

    //
    // CONNECTING: make sure the connection is established
    //
    if (bootPhase === NodeBootPhase.CONNECTING) {
      await wait(1000);
      if (connectionStatus === 'Connected') {
        logger.crumb(`connection to node established`);
        const signedUpWithInvite = Boolean(lureMeta?.id);
        return signedUpWithInvite
          ? NodeBootPhase.CHECKING_FOR_INVITE
          : NodeBootPhase.READY;
      }

      logger.crumb(`still connecting to node`, connectionStatus);
      return NodeBootPhase.CONNECTING;
    }

    //
    // CHECKING_FOR_INVITE [optional]: if we used an invite code to signup, see if we got the invites
    //
    if (bootPhase === NodeBootPhase.CHECKING_FOR_INVITE) {
      const { invitedDm, invitedGroup } =
        await BootHelpers.getInvitedGroupAndDm(lureMeta);

      if (invitedDm && invitedGroup) {
        logger.crumb('confirmed node has the invites');
        return NodeBootPhase.ACCEPTING_INVITES;
      }

      logger.crumb('checked node for invites, not yet found');
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
        logger.crumb(`accepting dm invitation`);
        await store.respondToDMInvite({ channel: tlonTeamDM, accept: true });
      }

      if (invitedDm && invitedDm.isDmInvite) {
        logger.crumb(`accepting dm invitation`);
        await store.respondToDMInvite({ channel: invitedDm, accept: true });
      }

      if (
        invitedGroup &&
        !invitedGroup.currentUserIsMember &&
        invitedGroup.haveInvite
      ) {
        logger.crumb('accepting group invitation');
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
        logger.crumb('successfully accepted invites');
        if (updatedTlonTeamDm) {
          store.pinItem(updatedTlonTeamDm);
        }
        return NodeBootPhase.READY;
      }

      logger.crumb(
        'still waiting on invites to be accepted',
        `dm is ready: ${dmIsGood}`,
        `group is ready: ${groupIsGood}`,
        `tlonTeam is ready: ${tlonTeamIsGood}`
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
          logger.crumb('waiting before retrying last phase');
          await wait(3000);
        }

        lastRunPhaseRef.current = bootPhase;
        lastRunErrored.current = false;
        logger.log(`running boot sequence phase: ${bootPhase}`);

        const nextBootPhase = await runBootPhase();
        setBootPhase(nextBootPhase);
      } catch (e) {
        logger.trackError('runBootPhase error', {
          bootPhase,
          errorMessage: e.message,
          errorStack: e.stack,
        });
        lastRunErrored.current = true;
        setBootPhase(bootPhase);
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
      logger.trackError('accept invites abort');
      setBootPhase(NodeBootPhase.READY);
      return;
    }

    if (![NodeBootPhase.IDLE, NodeBootPhase.READY].includes(bootPhase)) {
      runBootSequence();
    }
  }, [runBootPhase, setBootPhase, bootPhase]);

  // once finished, set the report
  useEffect(() => {
    if (bootPhase === NodeBootPhase.READY && report === null) {
      setReport({
        startedAt: sequenceStartTimeRef.current,
        completedAt: Date.now(),
      });
    }
  }, [bootPhase, report]);

  return {
    bootPhase,
    bootReport: report,
  };
}

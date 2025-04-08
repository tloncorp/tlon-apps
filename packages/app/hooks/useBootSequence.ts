import { AnalyticsEvent, createDevLogger } from '@tloncorp/shared';
import * as db from '@tloncorp/shared/db';
import * as store from '@tloncorp/shared/store';
import { preSig } from '@tloncorp/shared/urbit';
import { useCallback, useEffect, useRef, useState } from 'react';

import { useLureMetadata } from '../contexts/branch';
import { useShip } from '../contexts/ship';
import { BootPhaseNames, NodeBootPhase } from '../lib/bootHelpers';
import BootHelpers from '../lib/bootHelpers';
import { useConfigureUrbitClient } from './useConfigureUrbitClient';
import { usePosthog } from './usePosthog';

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

  The hook remains idle until explicitly kicked off by the caller. Gives up after HANDLE_INVITES_TIMEOUT 
  seconds if we're stuck processing invites, but the node is otherwise ready. Exposes the current boot 
  phase to the caller.
*/
export function useBootSequence() {
  const telemetry = usePosthog();
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

  const kickOffBootSequence = useCallback(() => {
    if (bootPhase === NodeBootPhase.IDLE) {
      setBootPhase(NodeBootPhase.RESERVING);
    }
  }, [bootPhase]);

  const runBootPhase = useCallback(async (): Promise<NodeBootPhase> => {
    const hostingUserId = await db.hostingUserId.getValue();
    if (!hostingUserId) {
      logger.crumb('no hosting user found, skipping');
      return bootPhase;
    }

    //
    // RESERVING: reserve a node for the hosting account, or get one if it already exists
    //
    if (bootPhase === NodeBootPhase.RESERVING) {
      const reservedNodeId = await BootHelpers.reserveNode(hostingUserId);
      setReservedNodeId(reservedNodeId);
      logger.crumb(`reserved node`, reservedNodeId);
      db.hostedAccountIsInitialized.setValue(true);
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
      const isReady = await BootHelpers.checkNodeBooted();
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
      try {
        const shipInfo = await store.authenticateWithReadyNode();
        if (!shipInfo) {
          throw new Error('Could not authenticate with node');
        }
        setShip(shipInfo);
        telemetry?.identify(preSig(shipInfo.ship!), { isHostedUser: true });

        await wait(2000);

        configureUrbitClient({
          shipName: shipInfo.ship,
          shipUrl: shipInfo.shipUrl,
        });
        store.syncStart();

        logger.crumb(`authenticated with node`);
        return NodeBootPhase.CONNECTING;
      } catch (err) {
        logger.crumb('failed to authenticate with node', err);
        return NodeBootPhase.AUTHENTICATING;
      }
    }

    //
    // CONNECTING: make sure the connection is established
    //
    if (bootPhase === NodeBootPhase.CONNECTING) {
      await wait(1000);
      if (connectionStatus === 'Connected') {
        logger.crumb(`connection to node established`);
        return NodeBootPhase.SCAFFOLDING_WAYFINDING;
      }

      logger.crumb(`still connecting to node`, connectionStatus);
      return NodeBootPhase.CONNECTING;
    }

    //
    // SCAFFOLDING WAYFINDING: make sure the starter group is created
    if (bootPhase === NodeBootPhase.SCAFFOLDING_WAYFINDING) {
      try {
        await store.scaffoldPersonalGroup();
        await db.showWayfindingSplash.setValue(true);
        const signedUpWithInvite = Boolean(lureMeta?.id);
        return signedUpWithInvite
          ? NodeBootPhase.CHECKING_FOR_INVITE
          : NodeBootPhase.READY;
      } catch (e) {
        return NodeBootPhase.SCAFFOLDING_WAYFINDING;
      }
    }

    //
    // CHECKING_FOR_INVITE [optional]: if we used an invite code to signup, see if we got the invites
    //
    if (bootPhase === NodeBootPhase.CHECKING_FOR_INVITE) {
      // always add the inviter as a contact first
      if (lureMeta?.inviterUserId) {
        store.addContact(lureMeta?.inviterUserId);
      }

      const { invitedDm, invitedGroup, tlonTeamDM } =
        await BootHelpers.getInvitedGroupAndDm(lureMeta);
      logger.trackEvent(AnalyticsEvent.InviteDebug, {
        context: 'invites to look for',
        invitedDm,
        invitedGroup,
        tlonTeamDM,
      });

      const requiredInvites =
        lureMeta?.inviteType === 'user' ? invitedDm : invitedGroup && invitedDm;

      if (requiredInvites) {
        logger.trackEvent(AnalyticsEvent.InviteDebug, {
          context: 'confirmed node has the invites',
        });
        return NodeBootPhase.ACCEPTING_INVITES;
      }

      logger.trackEvent(AnalyticsEvent.InviteDebug, {
        context: 'checked node for invites, not yet found',
      });
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
        logger.trackEvent(AnalyticsEvent.InviteDebug, {
          context: `have tlon team dm invite, accepting`,
        });
        await store.respondToDMInvite({ channel: tlonTeamDM, accept: true });
      }

      if (invitedDm && invitedDm.isDmInvite) {
        logger.trackEvent(AnalyticsEvent.InviteDebug, {
          context: `have dm invite from inviter, accepting`,
        });
        await store.respondToDMInvite({ channel: invitedDm, accept: true });
      }

      if (
        invitedGroup &&
        !invitedGroup.currentUserIsMember &&
        invitedGroup.haveInvite
      ) {
        logger.trackEvent(AnalyticsEvent.InviteDebug, {
          context: `have group invite, joining`,
        });
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
        personalGroup,
      } = await BootHelpers.getInvitedGroupAndDm(lureMeta);

      const dmIsGood = updatedDm && !updatedDm.isDmInvite;
      const tlonTeamIsGood = updatedTlonTeamDm && !updatedTlonTeamDm.isDmInvite;
      const groupIsGood =
        updatedGroup &&
        updatedGroup.currentUserIsMember &&
        updatedGroup.channels &&
        updatedGroup.channels.length > 0;

      const hadSuccess =
        lureMeta?.inviteType === 'user' ? dmIsGood : groupIsGood && dmIsGood;

      if (hadSuccess) {
        logger.crumb('successfully accepted invites');
        if (updatedTlonTeamDm) {
          store.pinChannel(updatedTlonTeamDm);
        }
        if (personalGroup) {
          store.pinGroup(personalGroup);
        }
        return NodeBootPhase.READY;
      }

      logger.trackEvent(AnalyticsEvent.InviteDebug, {
        context: `not all invites are confirmed accepted`,
        dmReady: dmIsGood,
        groupReady: groupIsGood,
        tlonTeamReady: tlonTeamIsGood,
      });
      return NodeBootPhase.ACCEPTING_INVITES;
    }

    return bootPhase;
  }, [
    bootPhase,
    configureUrbitClient,
    connectionStatus,
    lureMeta,
    reservedNodeId,
    setShip,
    telemetry,
  ]);

  // we increment a counter to ensure the effect executes after every run, even if
  // the step didn't advance
  const [bootStepCounter, setBootCounter] = useState(0);
  const tryingWayfindingSince = useRef<number | null>(null);
  const MAX_WAYFINDING_ATTEMPTS = 10;
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
        logger.log(`running boot sequence phase: ${BootPhaseNames[bootPhase]}`);

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
        setBootCounter((c) => c + 1);
      }
    };

    // if we're stuck trying to scaffold wayfinding, bail
    if (bootPhase === NodeBootPhase.SCAFFOLDING_WAYFINDING) {
      if (!tryingWayfindingSince.current) {
        tryingWayfindingSince.current = bootStepCounter;
      } else if (
        bootStepCounter - tryingWayfindingSince.current >
        MAX_WAYFINDING_ATTEMPTS
      ) {
        logger.trackEvent(AnalyticsEvent.ErrorWayfindingAbort, {
          context: 'exceeded max attempts',
        });
        const signedUpWithInvite = Boolean(lureMeta?.id);
        const nextBootPhase = signedUpWithInvite
          ? NodeBootPhase.CHECKING_FOR_INVITE
          : NodeBootPhase.READY;
        setBootPhase(nextBootPhase);
        return;
      }
    }

    // if we're stuck trying to handle invites afte user finishes signing up, bail
    const beenRunningTooLong =
      Date.now() - sequenceStartTimeRef.current > HANDLE_INVITES_TIMEOUT;
    const isInOptionalPhase = [
      NodeBootPhase.ACCEPTING_INVITES,
      NodeBootPhase.CHECKING_FOR_INVITE,
    ].includes(bootPhase);
    if (isInOptionalPhase && beenRunningTooLong) {
      logger.trackError('accept invites abort', { inviteId: lureMeta?.id });
      setBootPhase(NodeBootPhase.READY);
      return;
    }

    if (![NodeBootPhase.IDLE, NodeBootPhase.READY].includes(bootPhase)) {
      runBootSequence();
    }
  }, [runBootPhase, setBootPhase, bootPhase, bootStepCounter, lureMeta?.id]);

  const resetBootSequence = useCallback(() => {
    setBootPhase(NodeBootPhase.IDLE);
    setReport(null);
    setReservedNodeId(null);
    isRunningRef.current = false;
    lastRunPhaseRef.current = NodeBootPhase.IDLE;
    lastRunErrored.current = false;

    sequenceStartTimeRef.current = 0;
  }, []);

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
    kickOffBootSequence,
    resetBootSequence,
    bootReport: report,
  };
}

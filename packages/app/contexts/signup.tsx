import { createDevLogger } from '@tloncorp/shared/dist';
import * as store from '@tloncorp/shared/dist/store';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';

import { configureClient } from '../lib/api';
import { NodeBootPhase } from '../lib/bootHelpers';
import BootHelpers from '../lib/bootHelpers';
import { getShipFromCookie } from '../utils/ship';
import { useLureMetadata } from './branch';
import { useShip } from './ship';

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

interface SignupValues {
  nickname?: string;
  notificationToken?: string;
  telemetry?: boolean;
  didSignup?: boolean;

  hostingUser: { id: string } | null;
  reservedNodeId: string | null;
  bootPhase: NodeBootPhase;
}

interface SignupContext extends SignupValues {
  setHostingUser: (hostingUser: { id: string }) => void;
  setNickname: (nickname: string | undefined) => void;
  setNotificationToken: (notificationToken: string | undefined) => void;
  setTelemetry: (telemetry: boolean) => void;
  setDidSignup: (didSignup: boolean) => void;
  initializeBootSequence: () => void;
  clear: () => void;
}

const defaultContext: SignupContext = {
  nickname: undefined,
  hostingUser: null,
  reservedNodeId: null,
  bootPhase: NodeBootPhase.IDLE,
  setNickname: () => {},
  setNotificationToken: () => {},
  setTelemetry: () => {},
  setDidSignup: () => {},
  initializeBootSequence: () => {},
  setHostingUser: () => {},
  clear: () => {},
};

const logger = createDevLogger('signup', true);

const SignupContext = createContext<SignupContext>(defaultContext);

export const SignupProvider = ({ children }: { children: React.ReactNode }) => {
  const [values, setValues] = useState<SignupValues>(defaultContext);
  const { setShip } = useShip();
  const connectionStatus = store.useConnectionStatus();
  const lureMeta = useLureMetadata();

  const setBootPhase = useCallback((bootPhase: NodeBootPhase) => {
    setValues((current) => ({
      ...current,
      bootPhase,
    }));
  }, []);

  const initializeBootSequence = useCallback(() => {
    if (values.bootPhase === NodeBootPhase.IDLE) {
      setValues((current) => ({
        ...current,
        bootPhase: NodeBootPhase.RESERVING,
      }));
    }
  }, [values]);

  const runBootPhase = useCallback(async (): Promise<NodeBootPhase> => {
    const { hostingUser, bootPhase } = values;

    if (!hostingUser) {
      logger.log('no hosting user found, skipping');
      return bootPhase;
    }

    //
    // Step 1: reserve a node
    //
    if (bootPhase === NodeBootPhase.RESERVING) {
      const reservedNodeId = await BootHelpers.reserveNode(hostingUser.id);
      setValues((current) => ({
        ...current,
        reservedNodeId,
      }));
      logger.log(`reserved node`, reservedNodeId);
      return NodeBootPhase.BOOTING;
    }

    // you should not be able to advance past here unless reservedNodeId is set
    if (!values.reservedNodeId) {
      throw new Error(
        `cannot run boot phase ${bootPhase} without a reserved node`
      );
    }

    //
    // Step 2: confirm the node has finished booting on hosting
    //
    if (bootPhase === NodeBootPhase.BOOTING) {
      const isReady = await BootHelpers.checkNodeBooted(values.reservedNodeId);
      if (isReady) {
        logger.log('checked hosting, node is ready');
        return NodeBootPhase.AUTHENTICATING;
      }

      logger.log('checked hosting, node still booting');
      return NodeBootPhase.BOOTING;
    }

    //
    // Step 3: authenticate with the node itself
    //
    if (bootPhase === NodeBootPhase.AUTHENTICATING) {
      const auth = await BootHelpers.authenticateNode(values.reservedNodeId);
      console.log(`got auth`, auth);
      const ship = getShipFromCookie(auth.authCookie);
      console.log(`ship`, ship, auth.nodeId, auth.authCookie);

      setShip({
        ship,
        shipUrl: auth.nodeUrl,
        authCookie: auth.authCookie,
      });

      // TODO: connect to the API client?
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
    // finish connecting to the node
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
    // Step 4 [optional]: if we used an invite code to signup, see if we got the invites
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
    // Step 5 [optional]: join the invited groups
    //
    if (bootPhase === NodeBootPhase.ACCEPTING_INVITES) {
      const { invitedDm, invitedGroup } =
        await BootHelpers.getInvitedGroupAndDm(lureMeta);

      console.log(`invitedDm`, invitedDm);
      console.log(`invitedGroup`, invitedGroup);

      // if we have invites, accept them
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
      const { invitedDm: updatedDm, invitedGroup: updatedGroup } =
        await BootHelpers.getInvitedGroupAndDm(lureMeta);

      const dmIsGood = updatedDm && !updatedDm.isDmInvite;
      const groupIsGood =
        updatedGroup &&
        updatedGroup.currentUserIsMember &&
        updatedGroup.channels &&
        updatedGroup.channels.length > 0;

      if (dmIsGood && groupIsGood) {
        logger.log('successfully accepted invites');
        return NodeBootPhase.READY;
      }

      logger.log(
        'still waiting on invites to be accepted',
        `dm: ${dmIsGood}`,
        `group: ${groupIsGood}`
      );
      return NodeBootPhase.ACCEPTING_INVITES;
    }

    return bootPhase;
  }, [connectionStatus, lureMeta, setShip, values]);

  const isRunningRef = useRef(false);
  const lastRunPhaseRef = useRef(values.bootPhase);
  const lastRunErrored = useRef(false);
  useEffect(() => {
    const runBootSequence = async () => {
      // prevent simultaneous runs
      if (isRunningRef.current) {
        return;
      }

      isRunningRef.current = true;

      try {
        // if rerunning failed step, wait before retry
        const lastRunDidNotAdvance =
          values.bootPhase === lastRunPhaseRef.current;
        if (lastRunDidNotAdvance || lastRunErrored.current) {
          await wait(3000);
        }

        lastRunPhaseRef.current = values.bootPhase;
        lastRunErrored.current = false;

        logger.log(`running boot sequence phase: ${values.bootPhase}`);
        const nextBootPhase = await runBootPhase(); // TODO: i'm scared this will lock up if it hangs
        setBootPhase(nextBootPhase);
      } catch (e) {
        logger.error('boot phase errored', e.message, e);
        lastRunErrored.current = true;
        setBootPhase(values.bootPhase);

        // handle
      } finally {
        isRunningRef.current = false;
      }
    };

    if (![NodeBootPhase.IDLE, NodeBootPhase.READY].includes(values.bootPhase)) {
      runBootSequence();
    }
  }, [runBootPhase, setBootPhase, values.bootPhase]);

  const setHostingUser = useCallback((hostingUser: { id: string }) => {
    setValues((current) => ({
      ...current,
      hostingUser,
    }));
  }, []);

  const setNickname = useCallback((nickname: string | undefined) => {
    setValues((current) => ({
      ...current,
      nickname,
    }));
  }, []);

  const setNotificationToken = useCallback(
    (notificationToken: string | undefined) => {
      setValues((current) => ({
        ...current,
        notificationToken,
      }));
    },
    []
  );

  const setTelemetry = useCallback((telemetry: boolean) => {
    setValues((current) => ({
      ...current,
      telemetry,
    }));
  }, []);

  const setDidSignup = useCallback((didSignup: boolean) => {
    setValues((current) => ({
      ...current,
      didSignup,
    }));
  }, []);

  const clear = useCallback(() => {
    setValues({
      bootPhase: NodeBootPhase.IDLE,
      hostingUser: null,
      reservedNodeId: null,
    });
  }, []);

  return (
    <SignupContext.Provider
      value={{
        ...values,
        setHostingUser,
        setNickname,
        setNotificationToken,
        setTelemetry,
        setDidSignup,
        initializeBootSequence,
        clear,
      }}
    >
      {children}
    </SignupContext.Provider>
  );
};

export function useSignupContext() {
  const context = useContext(SignupContext);

  if (!context) {
    throw new Error('useSignupContext must be used within a SignupProvider');
  }

  return context;
}

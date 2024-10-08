import * as store from '@tloncorp/shared/dist/store';
import { createDevLogger } from 'packages/shared/dist';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';

import { NodeBootPhase } from '../lib/bootHelpers';
import BootHelpers from '../lib/bootHelpers';
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
  setNickname: (nickname: string | undefined) => void;
  setNotificationToken: (notificationToken: string | undefined) => void;
  setTelemetry: (telemetry: boolean) => void;
  setDidSignup: (didSignup: boolean) => void;
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
  clear: () => {},
};

const logger = createDevLogger('signup', true);

const SignupContext = createContext<SignupContext>(defaultContext);

export const SignupProvider = ({ children }: { children: React.ReactNode }) => {
  const [values, setValues] = useState<SignupValues>(defaultContext);
  const { setShip } = useShip();
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

  const runBootSequence = useCallback(async () => {
    const { hostingUser, bootPhase } = values;
    logger.log(`running boot sequence phase: ${bootPhase}`);

    if (!hostingUser) {
      logger.log('no hosting user found, skipping');
      return;
    }

    // Step 1: reserve a node
    if (bootPhase === NodeBootPhase.RESERVING) {
      const reservedNodeId = await BootHelpers.reserveNode(hostingUser.id);
      setValues((current) => ({
        ...current,
        reservedNodeId,
        bootPhase: NodeBootPhase.BOOTING,
      }));
      logger.log(`reserved node`, reservedNodeId);
      return;
    }

    if (!values.reservedNodeId) {
      throw new Error(
        `cannot run boot phase ${bootPhase} without a reserved node`
      );
    }

    // Step 2: confirm the node has finished booting on hosting
    if (bootPhase === NodeBootPhase.BOOTING) {
      const isReady = await BootHelpers.checkNodeBooted(values.reservedNodeId);
      if (isReady) {
        setValues((current) => ({
          ...current,
          bootPhase: NodeBootPhase.AUTHENTICATING,
        }));
        logger.log('checked hosting, node is ready');
      } else {
        logger.log('checked hosting, node still booting');
      }
      return;
    }

    // Step 3: authenticate with the node itself
    if (bootPhase === NodeBootPhase.AUTHENTICATING) {
      const auth = await BootHelpers.authenticateNode(values.reservedNodeId);
      setShip({
        ship: auth.nodeId,
        shipUrl: auth.nodeUrl,
        authCookie: auth.authCookie,
      });

      // TODO: connect to the API client?

      const signedUpWithInvite = Boolean(lureMeta?.id);
      setValues((current) => ({
        ...current,
        bootPhase: signedUpWithInvite
          ? NodeBootPhase.CHECKING_FOR_INVITE
          : NodeBootPhase.READY,
      }));
      return;
    }

    // Step 4 [optional]: if we used an invite code to signup, see if we got the invites
    if (bootPhase === NodeBootPhase.CHECKING_FOR_INVITE) {
      const { invitedDm, invitedGroup } =
        await BootHelpers.getInvitedGroupAndDm(lureMeta);

      if (invitedDm && invitedGroup) {
        setValues((current) => ({
          ...current,
          bootPhase: NodeBootPhase.ACCEPTING_INVITES,
        }));
        logger.log('confirmed node has the invites');
      } else {
        logger.log('checked node for invites, not yet found');
      }
      return;
    }

    // Step 5 [optional]: join the invited groups
    if (bootPhase === NodeBootPhase.ACCEPTING_INVITES) {
      const { invitedDm, invitedGroup } =
        await BootHelpers.getInvitedGroupAndDm(lureMeta);

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

      // give the join & accept some time to process, the hard refresh data
      await wait(2000);
      if (invitedGroup) {
        await store.syncGroup(invitedGroup?.id);
      }
      if (invitedDm) {
        await store.syncDms();
      }

      const { invitedDm: updatedDm, invitedGroup: updatedGroup } =
        await BootHelpers.getInvitedGroupAndDm(lureMeta);

      const dmIsGood = updatedDm && !updatedDm.isDmInvite;
      const groupIsGood =
        updatedGroup &&
        updatedGroup.currentUserIsMember &&
        updatedGroup.channels &&
        updatedGroup.channels.length > 0;

      if (dmIsGood && groupIsGood) {
        setValues((current) => ({
          ...current,
          bootPhase: NodeBootPhase.READY,
        }));
        logger.log('successfully accepted invites');
      } else {
        logger.log('still waiting on invites to be accepted');
      }
      return;
    }
  }, [lureMeta, setShip, values]);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (values.bootPhase !== NodeBootPhase.READY) {
      timer = setInterval(() => {
        runBootSequence();
      }, 5000);
    }
    return () => clearInterval(timer);
  }, [values.bootPhase, runBootSequence]);

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
        setNickname,
        setNotificationToken,
        setTelemetry,
        setDidSignup,
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

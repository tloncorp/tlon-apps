import {
  AnalyticsEvent,
  AnalyticsSeverity,
  createDevLogger,
} from '@tloncorp/shared';
import { HostedNodeStatus } from '@tloncorp/shared';
import * as db from '@tloncorp/shared/db';
import { useCallback, useEffect, useRef, useState } from 'react';

import { useStore } from '../ui';

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export enum NodeResumeState {
  WaitingForRunning,
  Authenticating,
  Ready,
  UnderMaintenance,
}

const logger = createDevLogger('StoppedNodeSequence', true);
const RE_CHECK_INTERVAL = 10 * 1000;

export function useStoppedNodeSequence(params: {
  waitType?: string;
  enabled: boolean;
}) {
  const store = useStore();
  const [bootedAt, setBootedAt] = useState<number>(0);
  const [bootStepCounter, setBootCounter] = useState(0);

  const [phase, setPhase] = useState(NodeResumeState.WaitingForRunning);
  const [shipInfo, setShipInfo] = useState<db.ShipInfo | null>(null);
  const [isBeingRevived, setIsBeingRevived] = useState(false);

  const isRunningRef = useRef(false);
  const lastRunPhaseRef = useRef(NodeResumeState.WaitingForRunning);
  const lastRunErrored = useRef(false);
  const sequenceStartTimeRef = useRef<number>(0);

  const checkNodeRunning = useCallback(async () => {
    try {
      // don't be too noisy with logging
      const supressStatusLog = bootStepCounter % 5 !== 0;

      const { status, isBeingRevived } =
        await store.checkHostingNodeStatus(supressStatusLog);
      if (status === HostedNodeStatus.UnderMaintenance) {
        return NodeResumeState.UnderMaintenance;
      }
      if (status === HostedNodeStatus.Running) {
        logger.crumb('confirmed node is running');
        setBootedAt(Date.now());
        setIsBeingRevived(isBeingRevived);
        return NodeResumeState.Authenticating;
      }

      logger.crumb('checked status, not running yet', { status });
      return NodeResumeState.WaitingForRunning;
    } catch (e) {
      logger.trackError('Login: Check node booted request failed', e);
      return NodeResumeState.WaitingForRunning;
    }
  }, [bootStepCounter, store]);

  const authenticateWithNode = useCallback(async () => {
    try {
      const shipInfo = await store.authenticateWithReadyNode();
      if (!shipInfo) {
        logger.crumb('failed to authenticate with node');
        return NodeResumeState.Authenticating;
      }

      logger.crumb('authenticated with node');
      const authedAt = Date.now();
      logger.trackEvent(AnalyticsEvent.NodeWaitReport, {
        intialNodeState: params.waitType ?? 'unknown',
        appLifecyle: 'login',
        timeToBoot: Math.floor(
          (bootedAt - sequenceStartTimeRef.current) / 1000
        ),
        timeToAuth: Math.floor((authedAt - bootedAt) / 1000),
        totalWaitTime: Math.floor(
          (authedAt - sequenceStartTimeRef.current) / 1000
        ),
        unit: 'seconds',
      });

      setShipInfo({ ...shipInfo, needsSplashSequence: isBeingRevived });
      return NodeResumeState.Ready;
    } catch (e) {
      logger.crumb('getting auth threw', e);
      return NodeResumeState.Authenticating;
    }
  }, [bootedAt, isBeingRevived, params.waitType, store]);

  const runPhase = useCallback(
    async (currPhase: NodeResumeState) => {
      switch (currPhase) {
        case NodeResumeState.WaitingForRunning:
          return checkNodeRunning();
        case NodeResumeState.Authenticating:
          return authenticateWithNode();
      }
      return currPhase;
    },
    [checkNodeRunning, authenticateWithNode]
  );

  const resetSequence = useCallback(() => {
    setPhase(NodeResumeState.WaitingForRunning);
    setShipInfo(null);
    sequenceStartTimeRef.current = 0;
    setBootedAt(0);
  }, []);

  useEffect(() => {
    async function runSequence() {
      if (!params.enabled) {
        return;
      }

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
        const lastRunDidNotAdvance = phase === lastRunPhaseRef.current;
        if (lastRunDidNotAdvance || lastRunErrored.current) {
          logger.crumb('waiting before retrying last phase');
          await wait(RE_CHECK_INTERVAL);
        }

        lastRunPhaseRef.current = phase;
        lastRunErrored.current = false;
        logger.log(`running stopped node sequence: ${NodeResumeState[phase]}`);

        const nextPhase = await runPhase(phase);
        setPhase(nextPhase);
      } catch (e) {
        logger.error('error running stopped node sequence', e);
        lastRunErrored.current = true;
        setPhase(phase);
      } finally {
        isRunningRef.current = false;
        setBootCounter((c) => c + 1);
      }
    }

    if (
      params.enabled &&
      [
        NodeResumeState.WaitingForRunning,
        NodeResumeState.Authenticating,
      ].includes(phase)
    ) {
      runSequence();
    }
  }, [params.enabled, phase, runPhase, bootStepCounter]);

  return {
    phase,
    shipInfo,
    resetSequence,
  };
}

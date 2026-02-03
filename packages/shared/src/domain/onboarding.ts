import type { NotificationLevel } from '../urbit/activity';

/*
 * Signup
 */
export interface SignupParams {
  phoneNumber?: string;
  email?: string;
  password?: string;
  nickname?: string;
  notificationToken?: string;
  notificationLevel?: NotificationLevel;
  telemetry?: boolean;
  didCompleteOnboarding?: boolean;
  reservedNodeId: string | null;
  bootPhase: NodeBootPhase;
  userWasReadyAt?: number;
  isGuidedLogin?: boolean;
}

export enum NodeBootPhase {
  IDLE = 1,
  RESERVING = 10,
  BOOTING = 20,
  AUTHENTICATING = 30,
  CONNECTING = 40,
  SCAFFOLDING_WAYFINDING = 50,
  CHECKING_FOR_INVITE = 60,
  ACCEPTING_INVITES = 70,
  READY = 200,
  ERROR = 400,
}

export const BootPhaseExplanations: Record<NodeBootPhase, string> = {
  [NodeBootPhase.IDLE]: 'Waiting to start',
  [NodeBootPhase.RESERVING]: 'Reserving your p2p node',
  [NodeBootPhase.BOOTING]: 'Booting your p2p node',
  [NodeBootPhase.AUTHENTICATING]: 'Authenticating with your node',
  [NodeBootPhase.CONNECTING]: 'Establishing a connection to your node',
  [NodeBootPhase.SCAFFOLDING_WAYFINDING]: 'Setting up your beginner wayfinding',
  [NodeBootPhase.CHECKING_FOR_INVITE]: 'Confirming your invites were received',
  [NodeBootPhase.ACCEPTING_INVITES]:
    'Initializing the conversations you were invited to',
  [NodeBootPhase.READY]: 'Your node is ready',
  [NodeBootPhase.ERROR]: 'Your node errored while initializing',
};

export const BootPhaseNames: Record<NodeBootPhase, string> = {
  [NodeBootPhase.IDLE]: 'Idle',
  [NodeBootPhase.RESERVING]: 'Reserving',
  [NodeBootPhase.BOOTING]: 'Booting',
  [NodeBootPhase.AUTHENTICATING]: 'Authenticating',
  [NodeBootPhase.CONNECTING]: 'Connecting',
  [NodeBootPhase.SCAFFOLDING_WAYFINDING]: 'Scaffolding Wayfinding',
  [NodeBootPhase.CHECKING_FOR_INVITE]: 'Checking for Invites',
  [NodeBootPhase.ACCEPTING_INVITES]: 'Accepting Invites',
  [NodeBootPhase.READY]: 'Ready',
  [NodeBootPhase.ERROR]: 'Error',
};

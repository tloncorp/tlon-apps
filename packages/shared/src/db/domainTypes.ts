/*
 * Signup
 */
export interface SignupParams {
  phoneNumber?: string;
  email?: string;
  password?: string;
  nickname?: string;
  notificationToken?: string;
  telemetry?: boolean;
  didCompleteOnboarding?: boolean;
  hostingUser: { id: string } | null;
  reservedNodeId: string | null;
  bootPhase: NodeBootPhase;
  userWasReadyAt?: number;
}

export enum NodeBootPhase {
  IDLE = 1,
  RESERVING = 2,
  BOOTING = 3,
  AUTHENTICATING = 4,
  CONNECTING = 5,
  CHECKING_FOR_INVITE = 6,
  ACCEPTING_INVITES = 7,
  READY = 200,
  ERROR = 400,
}

export const BootPhaseExplanations: Record<NodeBootPhase, string> = {
  [NodeBootPhase.IDLE]: 'Waiting to start',
  [NodeBootPhase.RESERVING]: 'Reserving your p2p node',
  [NodeBootPhase.BOOTING]: 'Booting your p2p node',
  [NodeBootPhase.AUTHENTICATING]: 'Authenticating with your node',
  [NodeBootPhase.CONNECTING]: 'Establishing a connection to your node',
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
  [NodeBootPhase.CHECKING_FOR_INVITE]: 'Checking for Invites',
  [NodeBootPhase.ACCEPTING_INVITES]: 'Accepting Invites',
  [NodeBootPhase.READY]: 'Ready',
  [NodeBootPhase.ERROR]: 'Error',
};

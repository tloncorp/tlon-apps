import type {
  FakeModelClient,
  ModelAuxiliaryCallKind,
  ReceivedCall,
  ScriptOptions,
  Step,
} from '../fake-model/index.js';

export type DriverName = 'hermes' | 'openclaw';

export type RuntimeCapability =
  | 'image_search'
  | 'upload_storage'
  | 'media_blob'
  | 'external_credentials';

export interface RuntimeCapabilityPartition {
  key: string;
  capabilities: readonly RuntimeCapability[];
}

export interface ShipEndpoint {
  ship: string;
  code: string;
  containerUrl: string;
  hostUrl: string;
  hostPort: number;
}

export interface RuntimeEndpoints {
  fakeModel: {
    containerBaseUrl: string;
    containerOpenAiBaseUrl: string;
    hostBaseUrl: string;
    hostOpenAiBaseUrl: string;
    hostPort: number;
  };
  ships: {
    zod: ShipEndpoint;
    ten: ShipEndpoint;
    mug: ShipEndpoint;
  };
  gateway?: {
    hostBaseUrl: string;
    hostPort: number;
  };
}

export interface RuntimeSeed {
  driverName: DriverName;
  repoRoot: string;
  runId: string;
  endpoints: RuntimeEndpoints;
  capabilityPartition?: RuntimeCapabilityPartition;
}

export interface DriverServices {
  bot: string;
  ships: string;
  fakeModel: string;
  logServices: string[];
}

export interface DriverRuntimeSpec {
  packageDir: string;
  composeProjectName: string;
  composeFiles: string[];
  services: DriverServices;
  composeEnv: Record<string, string>;
  testEnv: Record<string, string>;
}

export interface RuntimeTestMetadata {
  tlonMaxConsecutiveBotResponses?: string;
}

export interface RuntimeContext extends RuntimeSeed, DriverRuntimeSpec {
  fakeModel: FakeModelClient;
  testMetadata?: RuntimeTestMetadata;
}

export interface ComposeServiceState {
  name: string;
  service: string;
  state: string;
  status: string;
}

export interface ExecResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export interface ComposeHandle {
  ctx: RuntimeContext;
  projectName: string;
  composeFiles: string[];
  env: Record<string, string>;

  build(services?: string[]): Promise<void>;
  up(services?: string[]): Promise<void>;
  ps(opts?: { timeoutMs?: number }): Promise<ComposeServiceState[]>;
  logs(
    services?: string[],
    opts?: { tail?: number; timeoutMs?: number; allowFailure?: boolean }
  ): Promise<string>;
  exec(
    service: string,
    args: string[],
    opts?: { env?: Record<string, string>; cwd?: string }
  ): Promise<ExecResult>;
  down(opts?: {
    volumes?: boolean;
    allowFailure?: boolean;
    verify?: boolean;
    timeoutMs?: number;
  }): Promise<void>;
}

export interface BotDriver {
  name: DriverName;
  packageDir(seed: RuntimeSeed): string;
  resolveRuntime(seed: RuntimeSeed): DriverRuntimeSpec;
  beforeComposeBuild?(ctx: RuntimeContext): Promise<void>;
  beforeComposeUp?(ctx: RuntimeContext, compose: ComposeHandle): Promise<void>;
  waitReady(ctx: RuntimeContext, compose: ComposeHandle): Promise<void>;
  assertRuntimeConfig?(
    ctx: RuntimeContext,
    compose: ComposeHandle
  ): Promise<void>;
  collectDiagnostics?(
    ctx: RuntimeContext,
    compose: ComposeHandle
  ): Promise<string>;
  afterComposeDown?(ctx: RuntimeContext): Promise<void>;
  /**
   * True for background model calls the bot makes on its own schedule (e.g.
   * OpenClaw heartbeat polls) that negative "no model call" assertions should
   * ignore. Omitting it means the driver has no benign background calls.
   */
  isBenignModelCall?(call: ReceivedCall): boolean;
  model: ModelScriptAdapter;
}

export interface SendMessageArgs {
  target: string;
  message: string;
}

export interface ModelScript {
  steps: Step[];
  options?: ScriptOptions;
  expectations?: ModelScriptExpectations;
}

export interface ModelScriptExpectations {
  advertisedTools?: {
    include?: string[];
    exclude?: string[];
    exact?: string[];
  };
  expectedCallCount?: number;
  expectedCallSequence?: Array<{
    kind: 'model_request' | 'tool_call' | 'final_model_text';
    toolName?: string;
  }>;
  toolLoopResult?: boolean;
  streamedToolLoop?: boolean;
  /**
   * The driver has observable tool side effects, but the fake-model received
   * calls do not expose an OpenAI-format tool-result transcript for assertion.
   */
  toolEffectOnly?: boolean;
  allowUnclassifiedExtraCallsForDriverQuirk?: {
    reason: string;
  };
}

export type { ModelAuxiliaryCallKind };

export interface ModelScriptAdapter {
  replyText(text: string): ModelScript;
  replyTexts(texts: string[]): ModelScript;
  sendMessage(args: SendMessageArgs): ModelScript;
  readOrAdmin(command: string, finalText?: string): ModelScript;
  imageSearch(query: string): ModelScript;
}

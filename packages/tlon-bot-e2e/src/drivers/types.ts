import type { FakeModelClient, Step } from '../fake-model/index.js';

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
    opts?: { tail?: number; timeoutMs?: number }
  ): Promise<string>;
  exec(
    service: string,
    args: string[],
    opts?: { env?: Record<string, string>; cwd?: string }
  ): Promise<ExecResult>;
  down(opts?: { volumes?: boolean }): Promise<void>;
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
  model: ModelScriptAdapter;
}

export interface SendMessageArgs {
  target: string;
  message: string;
}

export interface ModelScript {
  steps: Step[];
  options?: {
    allowExtraCalls?: number;
  };
  expectations?: ModelScriptExpectations;
}

export interface ModelScriptExpectations {
  advertisedTools?: {
    include?: string[];
    exclude?: string[];
    exact?: string[];
  };
  expectedCallCount?: number;
  allowedAuxiliaryCalls?: ModelAuxiliaryCallKind[];
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

export type ModelAuxiliaryCallKind = 'hermes_title_generation';

export interface ModelScriptAdapter {
  replyText(text: string): ModelScript;
  sendMessage(args: SendMessageArgs): ModelScript;
  readOrAdmin(command: string, finalText?: string): ModelScript;
  imageSearch(query: string): ModelScript;
}

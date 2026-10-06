import {
  browserTelemetryContextSchema,
  type BrowserTelemetryContext,
} from '@tloncorp/api/client/browserTelemetry';

export function parseBrowserTelemetry(
  raw: string | undefined
): BrowserTelemetryContext | undefined {
  if (!raw) return undefined;
  try {
    return browserTelemetryContextSchema.safeParse(JSON.parse(raw)).data;
  } catch {
    return undefined;
  }
}

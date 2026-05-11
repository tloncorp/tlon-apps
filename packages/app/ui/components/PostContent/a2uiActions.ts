import type { A2UIActionSource, A2UIUserActionEnvelope } from '@tloncorp/api';
import type * as cn from '@tloncorp/shared/logic';

export type { A2UIActionSource, A2UIUserActionEnvelope };

export type A2UIActionSpec = {
  name?: unknown;
  context?: unknown;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function readPath(dataModel: Record<string, unknown>, path: string): unknown {
  if (!path || path === '/') {
    return dataModel;
  }

  return path
    .replace(/^\//, '')
    .split('/')
    .filter(Boolean)
    .reduce<unknown>((value, segment) => {
      if (!isRecord(value) && !Array.isArray(value)) {
        return undefined;
      }

      const key = segment.replace(/~1/g, '/').replace(/~0/g, '~');
      return Array.isArray(value) ? value[Number(key)] : value[key];
    }, dataModel);
}

export function resolveA2UIBoundValue(
  value: unknown,
  dataModel: Record<string, unknown>
): unknown {
  if (!isRecord(value)) {
    return value;
  }

  if ('literal' in value) {
    return value.literal;
  }

  const path =
    typeof value.path === 'string'
      ? value.path
      : typeof value.dataRef === 'string'
        ? value.dataRef
        : typeof value.dataBinding === 'string'
          ? value.dataBinding
          : null;

  return path ? readPath(dataModel, path) : value;
}

export function resolveA2UIActionContext(
  context: unknown,
  dataModel: Record<string, unknown>
): Record<string, unknown> {
  if (Array.isArray(context)) {
    return context.reduce<Record<string, unknown>>((resolved, item) => {
      if (!isRecord(item) || typeof item.key !== 'string') {
        return resolved;
      }

      resolved[item.key] = resolveA2UIBoundValue(item.value, dataModel);
      return resolved;
    }, {});
  }

  if (isRecord(context)) {
    return Object.entries(context).reduce<Record<string, unknown>>(
      (resolved, [key, value]) => {
        resolved[key] = resolveA2UIBoundValue(value, dataModel);
        return resolved;
      },
      {}
    );
  }

  return {};
}

export function buildA2UIUserActionEnvelope({
  block,
  sourceComponentId,
  action,
  timestamp = new Date().toISOString(),
}: {
  block: cn.A2UIBlockData;
  sourceComponentId: string;
  action: A2UIActionSpec | null | undefined;
  timestamp?: string;
}): A2UIUserActionEnvelope | null {
  if (!action || typeof action.name !== 'string' || !action.name.trim()) {
    return null;
  }

  return {
    userAction: {
      name: action.name.trim(),
      surfaceId: block.a2ui.surfaceId,
      sourceComponentId,
      timestamp,
      context: resolveA2UIActionContext(
        action.context,
        block.a2ui.dataModel ?? {}
      ),
    },
  };
}

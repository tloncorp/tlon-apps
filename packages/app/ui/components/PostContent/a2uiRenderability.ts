import {
  A2UI,
  type A2UIBlockData,
  type BlockData,
} from '@tloncorp/shared/logic';

export function isA2UIBlockRenderable(
  block: A2UIBlockData,
  canUseAgentProviderControls: boolean
) {
  const update = A2UI.getUpdateMessage(block.a2ui);
  const root = A2UI.getRootComponentId(block.a2ui);
  const components = new Map(
    update?.updateComponents.components.map((component) => [
      component.id,
      component,
    ]) ?? []
  );
  const visited = new Set<string>();

  const renders = (id: string): boolean => {
    if (visited.has(id)) return false;
    visited.add(id);
    const component = components.get(id);
    if (!component) return false;
    switch (component.component) {
      case 'Button':
      case 'Card':
        return renders(component.child);
      case 'Row':
      case 'Column':
        return component.children.some(renders);
      case 'McpConnect':
        return canUseAgentProviderControls;
      default:
        return true;
    }
  };

  return Boolean(root && renders(root));
}

export function hasRenderableA2UIStoryFallback(
  blocks: readonly BlockData[],
  canUseAgentProviderControls: boolean
) {
  return blocks.some(
    (block) =>
      block.type === 'a2ui' &&
      block.a2ui.storyMode === 'fallback' &&
      isA2UIBlockRenderable(block, canUseAgentProviderControls)
  );
}

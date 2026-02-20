import type { Node } from 'unist';
import type { PhrasingContent } from 'mdast';

/**
 * Walk an mdast tree in reverse child order, calling visitor for every node
 * matching the given type.  Reverse traversal is important: callers commonly
 * splice the children array inside the visitor, and reversing keeps earlier
 * indices stable.
 */
export function visit<T extends Node>(
  tree: Node,
  type: string,
  visitor: (
    node: T,
    index: number | undefined,
    parent: { children: PhrasingContent[] } | undefined
  ) => void
): void {
  function walk(
    node: Node,
    index: number | undefined,
    parent: { children: PhrasingContent[] } | undefined
  ): void {
    if (node.type === type) {
      visitor(node as T, index, parent);
    }

    if (
      'children' in node &&
      Array.isArray((node as { children: Node[] }).children)
    ) {
      const children = (node as { children: Node[] }).children;
      for (let i = children.length - 1; i >= 0; i--) {
        walk(children[i], i, node as { children: PhrasingContent[] });
      }
    }
  }

  walk(tree, undefined, undefined);
}

/**
 * Walk an mdast tree in forward order, calling visitor for every node
 * matching the given type.  Unlike visit() this does not provide index /
 * parent — use it for in-place mutations that do not change the tree shape
 * (e.g. flipping a flag on matching nodes).
 */
export function visitAll<T>(
  tree: Node,
  type: string,
  visitor: (node: T) => void
): void {
  function walk(node: Node): void {
    if (node.type === type) {
      visitor(node as T);
    }

    if (
      'children' in node &&
      Array.isArray((node as { children: Node[] }).children)
    ) {
      const children = (node as { children: Node[] }).children;
      for (const child of children) {
        walk(child);
      }
    }
  }

  walk(tree);
}

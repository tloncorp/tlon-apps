import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { NodeViewProps, findChildren } from '@tiptap/core';
import CodeBlock, { CodeBlockOptions } from '@tiptap/extension-code-block';
import { Node as ProsemirrorNode } from '@tiptap/pm/model';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import {
  NodeViewContent,
  NodeViewWrapper,
  ReactNodeViewRenderer,
} from '@tiptap/react';
import React, { useState } from 'react';
import hoon from 'refractor/lang/hoon.js';
import { refractor } from 'refractor/lib/common.js';

import CaretDown16Icon from '@/components/icons/CaretDown16Icon';

import './PrismCodeBlock.css';

export interface CodeBlockPrismOptions extends CodeBlockOptions {
  defaultLanguage: string | null | undefined;
}

function parseNodes(
  nodes: any[],
  className: string[] = []
): { text: string; classes: string[] }[] {
  return nodes
    .map((node) => {
      const classes = [
        ...className,
        ...(node.properties ? node.properties.className : []),
      ];

      if (node.children) {
        return parseNodes(node.children, classes);
      }

      return {
        text: node.value,
        classes,
      };
    })
    .flat();
}

function getHighlightNodes(result: any) {
  return result.children || [];
}

function getDecorations({
  doc,
  name,
  defaultLanguage,
}: {
  doc: ProsemirrorNode;
  name: string;
  defaultLanguage: string | null | undefined;
}) {
  const decorations: Decoration[] = [];
  const { highlight, listLanguages } = refractor;
  const allLanguages = listLanguages();

  findChildren(doc, (node) => node.type.name === name).forEach((block) => {
    let from = block.pos + 1;
    const language = block.node.attrs.language || defaultLanguage;
    if (!language || !allLanguages.includes(language)) {
      console.warn(
        'Unsupported language detected, this language has not been supported by prism: ',
        language
      );
      return;
    }
    const nodes = getHighlightNodes(
      highlight(block.node.textContent, language)
    );
    parseNodes(nodes).forEach((node) => {
      const to = from + node.text.length;

      if (node.classes.length) {
        const decoration = Decoration.inline(from, to, {
          class: node.classes.join(' '),
        });

        decorations.push(decoration);
      }

      from = to;
    });
  });
  return DecorationSet.create(doc, decorations);
}

function CodeBlockView(props: NodeViewProps) {
  const { node, updateAttributes } = props;
  const { listLanguages, register } = refractor;
  register(hoon);
  const allLanguages = listLanguages().sort();
  const providedLanguage: string | undefined = node.attrs?.language;
  const [selectedLanguage, setSelectedLanguage] = useState<string>(
    providedLanguage && allLanguages.includes(providedLanguage)
      ? providedLanguage
      : 'plaintext'
  );
  const options = allLanguages.map((l) => ({
    value: l,
    label: l.toUpperCase(),
  }));

  return (
    <NodeViewWrapper>
      <div className="not-prose rounded-xl bg-gray-100 p-3">
        <div
          contentEditable={false}
          className="flex items-center justify-between"
        >
          <DropdownMenu.Root>
            <DropdownMenu.Trigger className="small-button">
              {selectedLanguage.toUpperCase()}
              <CaretDown16Icon className="ml-2 h-4 w-4" />
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content className="dropdown max-h-64 w-48 overflow-y-auto">
                {options.map((o, i) => (
                  <DropdownMenu.Item
                    key={i}
                    className="dropdown-item"
                    onSelect={() => {
                      setSelectedLanguage(o.value);
                      updateAttributes({ language: o.value });
                    }}
                  >
                    {o.label}
                  </DropdownMenu.Item>
                ))}
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
          <button
            title="Remove"
            className="small-button"
            onClick={props.deleteNode}
          >
            Remove
          </button>
        </div>
        <pre className="not-prose">
          <NodeViewContent spellcheck="false" as="code" />
        </pre>
      </div>
    </NodeViewWrapper>
  );
}

const PrismCodeBlock = CodeBlock.extend<CodeBlockPrismOptions>({
  addOptions() {
    return {
      ...this.parent?.(),
      languageClassPrefix: 'language-',
      defaultLanguage: 'plaintext',
    };
  },
  addNodeView() {
    return ReactNodeViewRenderer(CodeBlockView);
  },
  addProseMirrorPlugins() {
    const { name, options } = this;
    return [
      ...(this.parent?.() || []),
      new Plugin({
        key: new PluginKey('prismPlugin'),

        state: {
          init: (_, { doc }) =>
            getDecorations({
              doc,
              name,
              defaultLanguage: options.defaultLanguage,
            }),
          apply(transaction, decorationSet, oldState, newState) {
            const oldNodeName = oldState.selection.$head.parent.type.name;
            const newNodeName = newState.selection.$head.parent.type.name;
            const oldNodes = findChildren(
              oldState.doc,
              (node) => node.type.name === name
            );
            const newNodes = findChildren(
              newState.doc,
              (node) => node.type.name === name
            );

            if (
              transaction.docChanged &&
              // Apply decorations if:
              // selection includes named node,
              ([oldNodeName, newNodeName].includes(name) ||
                // OR transaction adds/removes named node,
                newNodes.length !== oldNodes.length ||
                // OR transaction has changes that completely encapsulte a node
                // (for example, a transaction that affects the entire document).
                // Such transactions can happen during collab syncing via y-prosemirror, for example.
                transaction.steps.some(
                  (step) =>
                    // @ts-expect-error prosemirror#step
                    step.from !== undefined &&
                    // @ts-expect-error prosemirror#step
                    step.to !== undefined &&
                    oldNodes.some(
                      (node) =>
                        // @ts-expect-error prosemirror#step
                        node.pos >= step.from &&
                        // @ts-expect-error prosemirror#step
                        node.pos + node.node.nodeSize <= step.to
                    )
                ))
            ) {
              return getDecorations({
                doc: transaction.doc,
                name,
                defaultLanguage: options.defaultLanguage,
              });
            }

            return decorationSet.map(transaction.mapping, transaction.doc);
          },
        },

        props: {
          decorations(state) {
            return this.getState(state);
          },
        },
      }),
    ];
  },
});

export default PrismCodeBlock;

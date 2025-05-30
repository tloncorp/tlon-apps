import { Text } from '@tloncorp/ui';
import { ReactNode, useMemo } from 'react';
import { StyleSheet, TextStyle } from 'react-native';
import hoon from 'refractor/lang/hoon';
import { refractor } from 'refractor/lib/common.js';

refractor.register(hoon);

export function HighlightedCode({
  code,
  lang,
}: {
  code: string;
  lang?: string;
}) {
  return useMemo(() => {
    const tree = refractor.highlight(code, lang ?? 'plaintext') as TreeNode;
    return hastToReactNative(tree);
  }, [code, lang]);
}

function getStyles(className: string[] | undefined) {
  if (!className) {
    return null;
  }

  const styles = StyleSheet.create({
    'token comment': {
      color: '#999',
    },
    'token block-comment': {
      color: '#999',
    },
    'token prolog': {
      color: '#999',
    },
    'token doctype': {
      color: '#999',
    },
    'token cdata': {
      color: '#999',
    },
    'token punctuation': {
      color: '#ccc',
    },
    'token tag': {
      color: '#e2777a',
    },
    'token attr-name': {
      color: '#e2777a',
    },
    'token namespace': {
      color: '#e2777a',
    },
    'token deleted': {
      color: '#e2777a',
    },
    'token function-name': {
      color: '#6196cc',
    },
    'token boolean': {
      color: '#f08d49',
    },
    'token number': {
      color: '#f08d49',
    },
    'token function': {
      color: '#f08d49',
    },
    'token property': {
      color: '#f8c555',
    },
    'token class-name': {
      color: '#f8c555',
    },
    'token constant': {
      color: '#f8c555',
    },
    'token symbol': {
      color: '#f8c555',
    },
    'token selector': {
      color: '#cc99cd',
    },
    'token important': {
      color: '#cc99cd',
      fontWeight: 'bold',
    },
    'token atrule': {
      color: '#cc99cd',
    },
    'token keyword': {
      color: '#cc99cd',
    },
    'token builtin': {
      color: '#cc99cd',
    },
    'token string': {
      color: '#7ec699',
    },
    'token char': {
      color: '#7ec699',
    },
    'token attr-value': {
      color: '#7ec699',
    },
    'token regex': {
      color: '#7ec699',
    },
    'token variable': {
      color: '#7ec699',
    },
    'token operator': {
      color: '#67cdcc',
    },
    'token entity': {
      color: '#67cdcc',
      // cursor: 'help',
    },
    'token url': {
      color: '#67cdcc',
    },
    'token bold': {
      fontWeight: 'bold',
    },
    'token italic': {
      fontStyle: 'italic',
    },
    'token inserted': {
      color: 'green',
    },
  });

  const combinedClassNames = className.join(' ');

  return styles[combinedClassNames as keyof typeof styles] as TextStyle;
}

type TreeNodeType = 'text' | 'element' | 'root';

type TreeNode = {
  type: TreeNodeType;
  value: string;
  tagName: string;
  children: TreeNode[];
  properties: { className: string[] };
};

function hastToReactNative(tree: TreeNode, index?: number): ReactNode {
  if ('type' in tree && tree.type === 'text') {
    return tree.value;
  }

  if ('type' in tree && tree.type === 'element') {
    const children = (tree.children || []).map((child: TreeNode) =>
      hastToReactNative(child)
    );

    const classNames = tree.properties.className
      ? tree.properties.className.join(' ')
      : tree.tagName;
    const key = index ? `${classNames}-${index}` : classNames;

    return (
      <Text key={key} style={getStyles(tree.properties.className)}>
        {children}
      </Text>
    );
  }

  if ('type' in tree && tree.type === 'root') {
    return tree.children.map((child: TreeNode, i: number) =>
      hastToReactNative(child, i)
    );
  }

  return null;
}

export namespace A2UI {
  export type Text = {
    id: string;
    component: 'Text';
    text: string;
    variant?: 'caption' | 'h3' | 'h4';
  };

  export type NavigationTarget =
    | {
        type: 'message';
        channelId: string;
        postId: string;
        parentId?: string;
        authorId?: string;
        groupId?: string;
      }
    | {
        type: 'channel';
        channelId: string;
        groupId?: string;
        selectedPostId?: string;
      }
    | { type: 'group'; groupId: string }
    | { type: 'profile'; userId: string; groupId?: string; channelId?: string }
    | {
        type: 'chatDetails';
        chatType: 'group' | 'channel';
        chatId: string;
        groupId?: string;
      }
    | {
        type: 'chatVolume';
        chatType: 'group' | 'channel';
        chatId: string;
        groupId?: string;
      };

  export type ButtonAction = {
    event:
      | {
          name: typeof action.sendMessage;
          context: { text: string };
        }
      | {
          name: typeof action.navigate;
          context: { target: NavigationTarget };
        };
  };

  export type Button = {
    id: string;
    component: 'Button';
    child: string;
    variant?: 'default' | 'primary' | 'secondary' | 'borderless';
    action: ButtonAction;
  };

  export type Component =
    | Text
    | Button
    | {
        id: string;
        component: 'Card';
        child: string;
      }
    | {
        id: string;
        component: 'Column' | 'Row';
        children: string[];
      }
    | {
        id: string;
        component: 'Divider';
      };

  export type CreateSurfaceMessage = {
    version: 'v0.9';
    createSurface: {
      surfaceId: string;
      catalogId: string;
    };
  };

  export type UpdateComponentsMessage = {
    version: 'v0.9';
    updateComponents: {
      surfaceId: string;
      root: string;
      components: Component[];
    };
  };

  export type BlobEntry = {
    type: 'a2ui';
    version: 1;
    messages: Array<CreateSurfaceMessage | UpdateComponentsMessage>;
  };

  export const action = {
    sendMessage: 'tlon.sendMessage',
    navigate: 'tlon.navigate',
  } as const;

  function isObject(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
  }

  function isNonEmptyString(value: unknown): value is string {
    return typeof value === 'string' && value.trim().length > 0;
  }

  function isOptionalString(value: unknown): boolean {
    return value === undefined || isNonEmptyString(value);
  }

  function isNavigationTarget(value: unknown): value is NavigationTarget {
    if (!isObject(value)) {
      return false;
    }
    switch (value.type) {
      case 'message':
        return (
          isNonEmptyString(value.channelId) &&
          isNonEmptyString(value.postId) &&
          isOptionalString(value.parentId) &&
          isOptionalString(value.authorId) &&
          isOptionalString(value.groupId)
        );
      case 'channel':
        return (
          isNonEmptyString(value.channelId) &&
          isOptionalString(value.groupId) &&
          isOptionalString(value.selectedPostId)
        );
      case 'group':
        return isNonEmptyString(value.groupId);
      case 'profile':
        return (
          isNonEmptyString(value.userId) &&
          isOptionalString(value.groupId) &&
          isOptionalString(value.channelId)
        );
      case 'chatDetails':
      case 'chatVolume':
        return (
          (value.chatType === 'group' || value.chatType === 'channel') &&
          isNonEmptyString(value.chatId) &&
          isOptionalString(value.groupId)
        );
      default:
        return false;
    }
  }

  function isButtonAction(value: unknown): value is ButtonAction {
    if (!isObject(value) || !isObject(value.event)) {
      return false;
    }
    const { event } = value;
    if (event.name === action.sendMessage) {
      return isObject(event.context) && isNonEmptyString(event.context.text);
    }
    if (event.name === action.navigate) {
      return (
        isObject(event.context) && isNavigationTarget(event.context.target)
      );
    }
    return false;
  }

  function isComponent(value: unknown): value is Component {
    if (
      !isObject(value) ||
      typeof value.id !== 'string' ||
      typeof value.component !== 'string'
    ) {
      return false;
    }
    if (value.component === 'Text') {
      return typeof value.text === 'string';
    }
    if (value.component === 'Button') {
      return typeof value.child === 'string' && isButtonAction(value.action);
    }
    if (value.component === 'Card') {
      return typeof value.child === 'string';
    }
    if (value.component === 'Column' || value.component === 'Row') {
      return (
        Array.isArray(value.children) &&
        value.children.every((child) => typeof child === 'string')
      );
    }
    return value.component === 'Divider';
  }

  export function validateBlobEntry(entry: unknown): entry is BlobEntry {
    if (!isObject(entry) || entry.type !== 'a2ui' || entry.version !== 1) {
      return false;
    }
    if (!Array.isArray(entry.messages)) {
      return false;
    }

    return entry.messages.some((message) => {
      return (
        isObject(message) &&
        message.version === 'v0.9' &&
        isObject(message.updateComponents) &&
        typeof message.updateComponents.surfaceId === 'string' &&
        typeof message.updateComponents.root === 'string' &&
        Array.isArray(message.updateComponents.components) &&
        message.updateComponents.components.every(isComponent)
      );
    });
  }
}

import { A2UI } from '@tloncorp/api';
import crypto from 'node:crypto';
import type { ReplyPayload } from 'openclaw/plugin-sdk/core';
import { Type } from 'typebox';

import {
  combineBlobFields,
  makeA2UIBlob,
  serializeBlobField,
} from './urbit/blob.js';

const id = () => Type.String({ minLength: 1, maxLength: 200 });
const weight = () => Type.Optional(Type.Number({ minimum: 0, maximum: 12 }));
const iconNames = [
  'accountCircle',
  'add',
  'arrowBack',
  'arrowForward',
  'attachFile',
  'calendarToday',
  'call',
  'camera',
  'check',
  'close',
  'delete',
  'download',
  'edit',
  'event',
  'error',
  'fastForward',
  'favorite',
  'favoriteOff',
  'folder',
  'help',
  'home',
  'info',
  'locationOn',
  'lock',
  'lockOpen',
  'mail',
  'menu',
  'moreVert',
  'moreHoriz',
  'notificationsOff',
  'notifications',
  'pause',
  'payment',
  'person',
  'phone',
  'photo',
  'play',
  'print',
  'refresh',
  'rewind',
  'search',
  'send',
  'settings',
  'share',
  'shoppingCart',
  'skipNext',
  'skipPrevious',
  'star',
  'starHalf',
  'starOff',
  'stop',
  'upload',
  'visibility',
  'visibilityOff',
  'volumeDown',
  'volumeMute',
  'volumeOff',
  'volumeUp',
  'warning',
] as const satisfies readonly A2UI.IconName[];

const textComponent = Type.Object(
  {
    id: id(),
    component: Type.Literal('Text'),
    text: Type.String({ maxLength: 1000 }),
    variant: Type.Optional(
      Type.Union(
        ['body', 'caption', 'h1', 'h2', 'h3', 'h4', 'h5'].map((value) =>
          Type.Literal(value)
        )
      )
    ),
    weight: weight(),
  },
  { additionalProperties: false }
);

const imageComponent = Type.Object(
  {
    id: id(),
    component: Type.Literal('Image'),
    url: Type.String({
      minLength: 1,
      maxLength: 2048,
      description: 'Public http(s) image URL.',
    }),
    description: Type.Optional(Type.String({ maxLength: 500 })),
    fit: Type.Optional(
      Type.Union(
        ['contain', 'cover', 'fill', 'none', 'scaleDown'].map((value) =>
          Type.Literal(value)
        )
      )
    ),
    variant: Type.Optional(
      Type.Union(
        [
          'icon',
          'avatar',
          'smallFeature',
          'mediumFeature',
          'largeFeature',
          'header',
        ].map((value) => Type.Literal(value))
      )
    ),
    weight: weight(),
  },
  { additionalProperties: false }
);

const iconComponent = Type.Object(
  {
    id: id(),
    component: Type.Literal('Icon'),
    name: Type.Union(iconNames.map((value) => Type.Literal(value))),
    weight: weight(),
  },
  { additionalProperties: false }
);

function containerComponent(component: 'Row' | 'Column') {
  return Type.Object(
    {
      id: id(),
      component: Type.Literal(component),
      children: Type.Array(id(), { minItems: 1, maxItems: 12 }),
      justify: Type.Optional(
        Type.Union(
          [
            'start',
            'center',
            'end',
            'spaceBetween',
            'spaceAround',
            'spaceEvenly',
            'stretch',
          ].map((value) => Type.Literal(value))
        )
      ),
      align: Type.Optional(
        Type.Union(
          ['start', 'center', 'end', 'stretch'].map((value) =>
            Type.Literal(value)
          )
        )
      ),
      weight: weight(),
    },
    { additionalProperties: false }
  );
}

const cardComponent = Type.Object(
  {
    id: id(),
    component: Type.Literal('Card'),
    child: id(),
    weight: weight(),
  },
  { additionalProperties: false }
);

const dividerComponent = Type.Object(
  {
    id: id(),
    component: Type.Literal('Divider'),
    axis: Type.Optional(
      Type.Union([Type.Literal('horizontal'), Type.Literal('vertical')])
    ),
    weight: weight(),
  },
  { additionalProperties: false }
);

const buttonComponent = Type.Object(
  {
    id: id(),
    component: Type.Literal('Button'),
    child: id(),
    disabled: Type.Optional(Type.Boolean()),
    variant: Type.Optional(
      Type.Union(
        ['default', 'primary', 'secondary', 'borderless'].map((value) =>
          Type.Literal(value)
        )
      )
    ),
    action: Type.Object(
      {
        event: Type.Object(
          {
            name: Type.Literal(A2UI.action.sendMessage),
            context: Type.Object(
              { text: Type.String({ minLength: 1, maxLength: 1000 }) },
              { additionalProperties: false }
            ),
          },
          { additionalProperties: false }
        ),
      },
      { additionalProperties: false }
    ),
    weight: weight(),
  },
  { additionalProperties: false }
);

export const a2uiMessageToolProperty = Type.Optional(
  Type.Object(
    {
      root: Type.Optional(
        Type.String({
          minLength: 1,
          maxLength: 200,
          default: 'root',
          description: 'ID of the root component. Defaults to "root".',
        })
      ),
      components: Type.Array(
        Type.Union([
          cardComponent,
          containerComponent('Column'),
          containerComponent('Row'),
          textComponent,
          imageComponent,
          iconComponent,
          dividerComponent,
          buttonComponent,
        ]),
        { minItems: 1, maxItems: 50 }
      ),
    },
    {
      additionalProperties: false,
      description:
        'Tlon native A2UI widget. Supply a flat component graph; child and children fields reference component IDs. Use separate styled Text nodes, Rows, Columns, Dividers, Icons, and Images instead of one multiline Text node.',
    }
  )
);

type A2UIToolInput = {
  root?: unknown;
  components?: unknown;
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function buildA2UIBlobFromToolInput(value: unknown): string {
  if (!isPlainObject(value)) {
    throw new Error('Tlon A2UI must be an object with a components array.');
  }

  const input = value as A2UIToolInput;
  const root = input.root === undefined ? 'root' : input.root;
  if (typeof root !== 'string' || !root.trim()) {
    throw new Error('Tlon A2UI root must be a non-empty component ID.');
  }
  if (!Array.isArray(input.components)) {
    throw new Error('Tlon A2UI components must be an array.');
  }

  try {
    const surfaceId = `agent-${crypto.randomUUID()}`;
    return serializeBlobField(
      makeA2UIBlob(surfaceId, root, input.components as A2UI.Component[])
    );
  } catch {
    throw new Error(
      'Invalid Tlon A2UI component graph. Check unique IDs, root/child references, supported component fields, graph depth, and size limits.'
    );
  }
}

export function prepareA2UISendPayload(
  payload: ReplyPayload,
  value: unknown
): ReplyPayload {
  if (!payload.text?.trim()) {
    throw new Error(
      'Tlon A2UI sends require non-empty message text as a fallback.'
    );
  }

  const blob = buildA2UIBlobFromToolInput(value);
  const currentTlonData = isPlainObject(payload.channelData?.tlon)
    ? payload.channelData.tlon
    : {};
  const currentBlob =
    typeof currentTlonData.blob === 'string' ? currentTlonData.blob : undefined;

  return {
    ...payload,
    channelData: {
      ...payload.channelData,
      tlon: {
        ...currentTlonData,
        blob: combineBlobFields(currentBlob, blob),
      },
    },
  };
}

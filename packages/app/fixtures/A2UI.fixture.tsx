import { Text } from '@tloncorp/ui';
import { ScrollView, YStack } from 'tamagui';

import { A2UIBlock } from '../ui/components/PostContent/BlockRenderer';
import { FixtureWrapper } from './FixtureWrapper';

type A2UIComponent = {
  id: string;
  component: Record<string, Record<string, unknown>>;
};

type A2UIEntry = {
  type: 'a2ui';
  version: 1;
  protocolVersion: string;
  catalogId: string;
  root: string;
  title: string;
  icon?: string;
  emoji?: string;
  surfaceId: string;
  recipe?: string;
  components: A2UIComponent[];
  dataModel?: Record<string, unknown>;
  fallbackText?: string;
};

const CATALOG_ID = 'https://tlon.io/catalogs/ochre/v1/catalog.json';

const text = (literal: string) => ({ literal });

const children = (explicitList: string[]) => ({ explicitList });

function component(
  id: string,
  name: string,
  props: Record<string, unknown>
): A2UIComponent {
  return {
    id,
    component: {
      [name]: props,
    },
  };
}

function a2uiEntry(params: {
  title: string;
  icon?: string;
  emoji?: string;
  surfaceId: string;
  recipe?: string;
  components: A2UIComponent[];
  dataModel?: Record<string, unknown>;
  fallbackText?: string;
}): A2UIEntry {
  return {
    type: 'a2ui',
    version: 1,
    protocolVersion: '0.8',
    catalogId: CATALOG_ID,
    root: 'root',
    title: params.title,
    icon: params.icon,
    emoji: params.emoji,
    surfaceId: params.surfaceId,
    recipe: params.recipe,
    components: params.components,
    dataModel: params.dataModel,
    fallbackText: params.fallbackText,
  };
}

const weatherCard = a2uiEntry({
  title: 'Weather Current',
  icon: 'weather',
  surfaceId: 'fixture-weather',
  recipe: 'weather_card',
  components: [component('root', 'Card', { child: 'content' })],
  dataModel: {
    location: 'Austin, TX',
    temperature: '72F',
    summary: 'Clear skies',
    details: 'Light breeze',
    forecast: [
      { day: 'Mon', temp: '74F', summary: 'Clear' },
      { day: 'Tue', temp: '76F', summary: 'Sunny' },
      { day: 'Wed', temp: '71F', summary: 'Partly cloudy' },
      { day: 'Thu', temp: '73F', summary: 'Clear' },
      { day: 'Fri', temp: '75F', summary: 'Sunny' },
    ],
  },
});

const dmApprovalCard = a2uiEntry({
  title: 'DM access request',
  icon: 'dm',
  surfaceId: 'fixture-dm-approval',
  recipe: 'approval_card',
  components: [component('root', 'Card', { child: 'content' })],
  dataModel: {
    approvalType: 'dm',
    approvalId: 'dm-123',
    requestingShip: '~pinser-botter-timryd-macnus',
    reason: 'Allow this ship to message the bot.',
    messagePreview: 'hi',
  },
});

const groupApprovalCard = a2uiEntry({
  title: 'Group invite request',
  icon: 'group',
  surfaceId: 'fixture-group-approval',
  recipe: 'approval_card',
  components: [component('root', 'Card', { child: 'content' })],
  dataModel: {
    approvalType: 'group',
    approvalId: 'group-123',
    requestingShip: '~sampel-palnet',
    groupTitle: 'Tlon Builders',
    groupFlag: '~sampel-palnet/builders',
    reason: 'Allow the bot to join this group.',
  },
});

const genericApprovalCard = a2uiEntry({
  title: 'Expense approval',
  icon: 'receipt',
  emoji: '🧾',
  surfaceId: 'fixture-generic-approval',
  recipe: 'approval_card',
  components: [component('root', 'Card', { child: 'content' })],
  dataModel: {
    approvalType: 'generic',
    amount: '$120',
    emoji: '🧾',
    reason: 'Alice requested reimbursement for team lunch.',
  },
});

const dashboardCard = a2uiEntry({
  title: 'AAPL Stock - Last 7 Days',
  icon: 'stock',
  emoji: '📈',
  surfaceId: 'fixture-dashboard',
  recipe: 'data_dashboard',
  fallbackText: 'AAPL Stock - Last 7 Days: latest $214.20.',
  components: [
    component('root', 'Card', { child: 'content' }),
    component('content', 'Column', {
      gap: 'medium',
      children: children(['title', 'summary', 'metrics', 'progress', 'rows']),
    }),
    component('title', 'Text', {
      text: text('AAPL Stock - Last 7 Days'),
      usageHint: 'h3',
    }),
    component('summary', 'Text', {
      text: text('Closing price trend from the last trading week.'),
      usageHint: 'body',
    }),
    component('metrics', 'Row', {
      gap: 'small',
      wrap: true,
      children: children(['latest', 'change', 'range']),
    }),
    component('latest', 'Stack', {
      gap: 'xsmall',
      children: children(['latest-value', 'latest-label']),
    }),
    component('latest-value', 'Text', {
      text: text('$214.20'),
      usageHint: 'h3',
    }),
    component('latest-label', 'Text', {
      text: text('Latest'),
      usageHint: 'caption',
    }),
    component('change', 'Stack', {
      gap: 'xsmall',
      children: children(['change-value', 'change-label']),
    }),
    component('change-value', 'Text', {
      text: text('+$1.70'),
      usageHint: 'h3',
    }),
    component('change-label', 'Text', {
      text: text('Week'),
      usageHint: 'caption',
    }),
    component('range', 'Stack', {
      gap: 'xsmall',
      children: children(['range-value', 'range-label']),
    }),
    component('range-value', 'Text', {
      text: text('$211-$216'),
      usageHint: 'h3',
    }),
    component('range-label', 'Text', {
      text: text('Range'),
      usageHint: 'caption',
    }),
    component('progress', 'Progress', {
      value: 72,
      label: text('Confidence 72%'),
    }),
    component('rows', 'Column', {
      gap: 'xsmall',
      children: children(['row-1', 'row-2', 'row-3']),
    }),
    component('row-1', 'Row', {
      justify: 'between',
      children: children(['row-1-label', 'row-1-value']),
    }),
    component('row-1-label', 'Text', {
      text: text('Mon - AAPL'),
      usageHint: 'caption',
    }),
    component('row-1-value', 'Text', {
      text: text('$212.50'),
      usageHint: 'body',
    }),
    component('row-2', 'Row', {
      justify: 'between',
      children: children(['row-2-label', 'row-2-value']),
    }),
    component('row-2-label', 'Text', {
      text: text('Tue - AAPL'),
      usageHint: 'caption',
    }),
    component('row-2-value', 'Text', {
      text: text('$214.20'),
      usageHint: 'body',
    }),
    component('row-3', 'Row', {
      justify: 'between',
      children: children(['row-3-label', 'row-3-value']),
    }),
    component('row-3-label', 'Text', {
      text: text('Wed - AAPL'),
      usageHint: 'caption',
    }),
    component('row-3-value', 'Text', {
      text: text('$213.90'),
      usageHint: 'body',
    }),
  ],
  dataModel: {
    emoji: '📈',
    metrics: [
      { label: 'Latest', value: '$214.20', emoji: '📈' },
      { label: 'Week', value: '+$1.70', emoji: '📊' },
      { label: 'Range', value: '$211-$216', emoji: '📏' },
    ],
    series: [
      {
        label: 'AAPL',
        unit: '$',
        labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
        values: [212.5, 214.2, 213.9, 216.1, 214.2],
      },
    ],
    rows: [
      { label: 'Mon', value: '$212.50', detail: 'AAPL' },
      { label: 'Tue', value: '$214.20', detail: 'AAPL' },
      { label: 'Wed', value: '$213.90', detail: 'AAPL' },
      { label: 'Thu', value: '$216.10', detail: 'AAPL' },
      { label: 'Fri', value: '$214.20', detail: 'AAPL' },
    ],
  },
});

const genericComponentCard = a2uiEntry({
  title: 'Generic components',
  surfaceId: 'fixture-generic-components',
  components: [
    component('root', 'Card', { child: 'content' }),
    component('content', 'Column', {
      gap: 'medium',
      children: children([
        'title',
        'body',
        'status',
        'progress',
        'actions',
        'divider',
        'caption',
      ]),
    }),
    component('title', 'Text', {
      text: text('Generic Ochre surface'),
      usageHint: 'h3',
    }),
    component('body', 'Text', {
      text: text('This exercises the fallback A2UI component renderer.'),
      usageHint: 'body',
    }),
    component('status', 'Badge', { label: text('Active') }),
    component('progress', 'Progress', {
      value: 48,
      label: text('Progress 48%'),
    }),
    component('actions', 'Row', {
      gap: 'small',
      children: children(['approve', 'cancel']),
    }),
    component('approve', 'Button', {
      label: text('Approve'),
      intent: 'positive',
      action: { name: 'fixture.approve', context: [] },
    }),
    component('cancel', 'Button', {
      label: text('Cancel'),
      intent: 'secondary',
      action: { name: 'fixture.cancel', context: [] },
    }),
    component('divider', 'Divider', {}),
    component('caption', 'Text', {
      text: text(
        'Unsupported recipe names should still render via components.'
      ),
      usageHint: 'caption',
    }),
  ],
});

type A2UIExample = {
  label: string;
  entry: A2UIEntry;
};

const examples: A2UIExample[] = [
  { label: 'Weather', entry: weatherCard },
  { label: 'DM approval', entry: dmApprovalCard },
  { label: 'Group approval', entry: groupApprovalCard },
  { label: 'Generic approval', entry: genericApprovalCard },
  { label: 'Dashboard', entry: dashboardCard },
  { label: 'Generic fallback', entry: genericComponentCard },
] as const;

function A2UISpecimen({ label, entry }: A2UIExample) {
  return (
    <YStack gap="$m">
      <Text size="$label/m" color="$tertiaryText">
        {label}
      </Text>
      <A2UIBlock block={{ type: 'a2ui', a2ui: entry }} />
    </YStack>
  );
}

function A2UIFixtureGallery({
  entries = examples,
}: {
  entries?: A2UIExample[];
}) {
  return (
    <FixtureWrapper fillWidth fillHeight safeArea={false}>
      <ScrollView
        contentContainerStyle={{
          padding: 16,
          gap: 16,
          maxWidth: 520,
          width: '100%',
          alignSelf: 'center',
        }}
      >
        {entries.map((example) => (
          <A2UISpecimen
            key={example.entry.surfaceId}
            label={example.label}
            entry={example.entry}
          />
        ))}
      </ScrollView>
    </FixtureWrapper>
  );
}

export default {
  All: <A2UIFixtureGallery />,
  Weather: <A2UIFixtureGallery entries={[examples[0]]} />,
  DMApproval: <A2UIFixtureGallery entries={[examples[1]]} />,
  GroupApproval: <A2UIFixtureGallery entries={[examples[2]]} />,
  GenericApproval: <A2UIFixtureGallery entries={[examples[3]]} />,
  Dashboard: <A2UIFixtureGallery entries={[examples[4]]} />,
  GenericFallback: <A2UIFixtureGallery entries={[examples[5]]} />,
};

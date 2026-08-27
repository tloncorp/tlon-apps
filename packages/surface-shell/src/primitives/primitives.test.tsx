import { render } from 'preact';
import { expect, test } from 'vitest';

import {
  Avatar,
  Badge,
  BrokenState,
  Button,
  Card,
  EmptyState,
  ListRow,
  Progress,
  SectionHeader,
  Stat,
} from './index';

function mount(node: preact.ComponentChild) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  render(node, container);
  return container;
}

test('Card renders title and children', () => {
  const el = mount(
    <Card title="Potluck">
      <span>row</span>
    </Card>
  );
  expect(el.querySelector('.tsh-card')).toBeTruthy();
  expect(el.querySelector('.tsh-card-title')?.textContent).toBe('Potluck');
  expect(el.textContent).toContain('row');
});

test('ListRow places left, content, and right', () => {
  const el = mount(
    <ListRow left={<Avatar initials="ZD" />} right={<Badge>3</Badge>}>
      middle
    </ListRow>
  );
  expect(el.querySelector('.tsh-list-row')).toBeTruthy();
  expect(el.querySelector('.tsh-avatar')).toBeTruthy();
  expect(el.querySelector('.tsh-list-row-content')?.textContent).toBe('middle');
  expect(el.querySelector('.tsh-badge')?.textContent).toBe('3');
});

test('Button fires onPress; disabled buttons do not', () => {
  let presses = 0;
  const el = mount(<Button onPress={() => presses++}>Vote</Button>);
  const button = el.querySelector('button')!;
  button.click();
  expect(presses).toBe(1);

  const disabledEl = mount(
    <Button disabled onPress={() => presses++}>
      Vote
    </Button>
  );
  const disabledButton = disabledEl.querySelector('button')!;
  expect(disabledButton.disabled).toBe(true);
  disabledButton.click();
  expect(presses).toBe(1);
});

test('Button tones map to token classes', () => {
  const el = mount(<Button tone="negative">Delete</Button>);
  expect(el.querySelector('button')?.className).toContain(
    'tsh-button--negative'
  );
});

test('Stat renders value, label, and optional hint', () => {
  const el = mount(<Stat value="12" label="votes" hint="of 20" />);
  expect(el.querySelector('.tsh-stat-value')?.textContent).toBe('12');
  expect(el.querySelector('.tsh-stat-label')?.textContent).toBe('votes');
  expect(el.querySelector('.tsh-stat-hint')?.textContent).toBe('of 20');
});

test('Badge tones map to token classes', () => {
  const el = mount(<Badge tone="positive">new</Badge>);
  expect(el.querySelector('.tsh-badge--positive')?.textContent).toBe('new');
});

test('Avatar shows at most two characters and takes color from props', () => {
  const el = mount(<Avatar initials="ZOD" color="var(--color-positive-bg)" />);
  const avatar = el.querySelector('.tsh-avatar') as HTMLElement;
  expect(avatar.textContent).toBe('ZO');
  expect(avatar.style.background).toContain('var(--color-positive-bg)');
});

test('Progress clamps and exposes aria values', () => {
  const el = mount(<Progress value={1.5} label="turnout" />);
  const bar = el.querySelector('.tsh-progress')!;
  expect(bar.getAttribute('aria-valuenow')).toBe('100');
  const fill = el.querySelector('.tsh-progress-fill') as HTMLElement;
  expect(fill.style.width).toBe('100%');

  const nan = mount(<Progress value={Number.NaN} />);
  expect(
    nan.querySelector('.tsh-progress')?.getAttribute('aria-valuenow')
  ).toBe('0');
});

test('EmptyState and SectionHeader render their text', () => {
  const el = mount(
    <div>
      <SectionHeader>Responses</SectionHeader>
      <EmptyState title="Nothing yet" description="Votes appear here" />
    </div>
  );
  expect(el.querySelector('.tsh-section-header')?.textContent).toBe(
    'Responses'
  );
  expect(el.querySelector('.tsh-empty-state-title')?.textContent).toBe(
    'Nothing yet'
  );
  expect(el.querySelector('.tsh-empty-state-description')?.textContent).toBe(
    'Votes appear here'
  );
});

test('BrokenState renders the labeled error box', () => {
  const el = mount(<BrokenState detail="boom" />);
  expect(el.querySelector('.tsh-broken')).toBeTruthy();
  expect(el.textContent).toContain('This app hit an error');
  expect(el.textContent).toContain('boom');
});

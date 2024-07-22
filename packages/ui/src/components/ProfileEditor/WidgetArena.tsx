import { useState } from 'react';

import { Stack, Text, View, XStack, YStack } from '../../core';
import DraggableWidget from './DraggableWidget';
import { GridMeasure, WidgetInstance } from './types';
import { ProfileRow } from './widgets/ProfileRow';

function genInitialWidget() {
  const STARTING_PROFILE_WIDGET: WidgetInstance = {
    id: 'profile',
    title: 'Profile',
    typeId: 'tlon:profile',
    data: {
      profile: {
        nickname: 'shadow brian',
        patp: '~dozped-mogtec',
        avatar:
          'https://d2w9rnfcy7mm78.cloudfront.net/29558369/original_8781793096ae0f468370a1c74dc74034.png',
        bio: `’Twas brillig, and the slithy toves Did gyre and gimble in the wabe: All mimsy were the borogoves, And the mome raths outgrabe. “Beware the Jabberwock, my son! The jaws that bite, the claws that catch! Beware the Jubjub bird, and shun The frumious Bandersnatch!”`,
      },
      variant: 'row',
    },

    position: {
      rowStart: 0,
      colStart: 0,
      numCols: 4,
      numRows: 2,
      layer: 0,
    },
  };

  return STARTING_PROFILE_WIDGET;
}

export default function WidgetArena({ grid }: { grid: GridMeasure }) {
  const [widgets, setWidgets] = useState<WidgetInstance[]>([
    genInitialWidget(),
  ]);
  const [addOpen, setAddOpen] = useState(false);

  console.log(`widget state`, widgets);

  // const addWidget = (id: string) => {
  //   const type = WIDGET_TYPES.find((w) => w.id === id);
  //   console.log(`adding a ${type.name} widget...`);

  //   const instance = WidgetFactory(type.id, widgets.length);
  //   setWidgets([...widgets, instance]);
  //   setAddOpen(false);
  // };

  return (
    <View
      position="absolute"
      top={grid.y + grid.borderWidth}
      left={grid.x + grid.borderWidth}
      height={grid.cellSize * grid.numRows - grid.borderWidth * 2}
      width={grid.cellSize * grid.numCols - grid.borderWidth * 2}
    >
      {widgets.map((widget) => renderWidget(grid, widget))}
    </View>
  );
}

function renderWidget(measure: GridMeasure, instance: WidgetInstance) {
  let component;
  if (isProfileWidget(instance)) {
    component = <ProfileRow data={instance.data.profile} />;
  } else {
    console.log('UH OH! widget not found');
  }

  return (
    <DraggableWidget
      key={instance.id}
      measure={measure}
      position={instance.position}
      component={component}
    />
  );
}

function isProfileWidget(instance: WidgetInstance): boolean {
  return true;
}

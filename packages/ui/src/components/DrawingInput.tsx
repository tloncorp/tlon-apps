import * as sk from '@shopify/react-native-skia';
import { Skia } from '@shopify/react-native-skia';
import * as FileSystem from 'expo-file-system';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { interpolate, useSharedValue } from 'react-native-reanimated';
import { styled } from 'tamagui';

import { useAttachmentContext } from '../contexts';
import { Text, View, XStack, YStack } from '../core';
import { Button } from './Button';
import { Icon } from './Icon';

const pixelated = Skia.RuntimeEffect.Make(`
  uniform vec2 amount; // number of pixels per axis
  uniform vec2 resolution;
  uniform shader image;

  half4 main(vec2 uv) {
    vec2 blockSize = resolution / amount; 
    vec2 coord = floor((floor(uv / blockSize) + 0.5) * blockSize);
    return floor(image.eval(coord) + .25);
  }`)!;

const rec = Skia.PictureRecorder();
rec.beginRecording(Skia.XYWHRect(0, 0, 1, 1));
const emptyPicture = rec.finishRecordingAsPicture();

const drawPaint = Skia.Paint();
drawPaint.setColor(Skia.Color(0xff000000));
drawPaint.setAntiAlias(false);
drawPaint.setStrokeWidth(10);
drawPaint.setStyle(sk.PaintStyle.Stroke);
drawPaint.setStrokeCap(sk.StrokeCap.Round);
drawPaint.setStrokeJoin(sk.StrokeJoin.Round);

const erasePaint = Skia.Paint();
erasePaint.setColor(Skia.Color(0xffffffff));
erasePaint.setAntiAlias(false);
erasePaint.setStrokeWidth(10);
erasePaint.setStyle(sk.PaintStyle.Stroke);

const renderPath = (
  path: sk.SkPath,
  paint: sk.SkPaint,
  lastPicture?: sk.SkPicture
) => {
  'worklet';
  const recorder = Skia.PictureRecorder();
  const canvas = recorder.beginRecording(
    Skia.XYWHRect(0, 0, 2_000_000, 2_000_000)
  );
  if (lastPicture) {
    canvas.drawPicture(lastPicture);
  }
  canvas.drawPath(path, paint);
  return recorder.finishRecordingAsPicture();
};

const brushSizes = [4, 10];

export const DrawingInput = ({
  filter,
  onPressAttach,
}: {
  filter?: 'pixel';
  onPressAttach: () => void;
}) => {
  const currentPath = useSharedValue(Skia.Path.Make());
  const isDrawing = useSharedValue(false);
  const pointerPosition = useSharedValue({ x: 0, y: 0 });
  const picture = useSharedValue<sk.SkPicture>(emptyPicture);
  const canvasRef = useRef<sk.SkiaDomView>(null);

  const [tool, setTool] = useState<'draw' | 'erase'>('draw');
  const [size, setSize] = useState<'small' | 'large'>('small');
  const paintRef = useSharedValue<sk.SkPaint>(drawPaint);

  const pan = Gesture.Pan()
    .averageTouches(true)
    .minDistance(0)
    .shouldCancelWhenOutside(false)
    .maxPointers(1)
    .onBegin((e) => {
      currentPath.value.reset();
      currentPath.value.moveTo(e.x, e.y);
      console.log('begin');
      isDrawing.value = true;
      pointerPosition.value = { x: e.x, y: e.y };
    })
    .onChange((e) => {
      pointerPosition.value = {
        x: interpolate(0.4, [0, 1], [pointerPosition.value.x, e.x]),
        y: interpolate(0.4, [0, 1], [pointerPosition.value.y, e.y]),
      };
      currentPath.value.lineTo(
        pointerPosition.value.x,
        pointerPosition.value.y
      );
      sk.notifyChange(currentPath);
      pointerPosition.value = { x: e.x, y: e.y };
    })
    .onEnd((e) => {
      console.log('end', tool);
      picture.value = renderPath(
        currentPath.value,
        paintRef.value,
        picture.value
      );
      currentPath.value.reset();
      sk.notifyChange(currentPath);
      isDrawing.value = false;
    });

  const [w, h] = [142, 256];
  const scale = 3;
  const uniforms = {
    amount: [w / scale, h / scale], // grid 20x20;
    resolution: [142, 256],
  };

  useEffect(() => {
    if (size === 'small') {
      paintRef.value.setStrokeWidth(brushSizes[0]);
    } else {
      paintRef.value.setStrokeWidth(brushSizes[1]);
    }
    if (tool === 'draw') {
      paintRef.value.setColor(Skia.Color(0xff000000));
    } else {
      paintRef.value.setColor(Skia.Color(0xffffffff));
    }
    sk.notifyChange(paintRef);
  }, [tool, size]);

  const handlePressErase = useCallback(() => {
    setTool(`erase`);
  }, []);

  const handlePressDraw = useCallback(() => {
    setTool(`draw`);
  }, []);

  const handlePressSizeLarge = useCallback(() => {
    setSize(`large`);
  }, []);

  const handlePressSizeSmall = useCallback(() => {
    setSize('small');
  }, []);

  const handlePressClear = useCallback(() => {
    picture.value = emptyPicture;
  }, []);

  const { attachAssets } = useAttachmentContext();

  const handlePressAttach = useCallback(async () => {
    const result = await canvasRef.current?.makeImageSnapshotAsync();
    const str = result?.encodeToBase64();
    const uri = FileSystem.cacheDirectory + `drawing-${Date.now()}.png`;
    await FileSystem.writeAsStringAsync(uri, str ?? '', {
      encoding: 'base64',
    });
    attachAssets([
      {
        type: 'image',
        uri,
        width: 200,
        height: 100,
      },
    ]);
    onPressAttach?.();
  }, [attachAssets, onPressAttach]);

  return (
    <YStack flex={1} gap="$m">
      <View
        borderRadius="$m"
        height={200}
        flex={1}
        borderWidth={1}
        borderColor={'$border'}
        overflow="hidden"
      >
        <GestureDetector gesture={pan}>
          <sk.Canvas ref={canvasRef} style={{ flex: 1 }}>
            <sk.Group
              layer={
                filter === 'pixel' ? (
                  <sk.Paint>
                    <sk.RuntimeShader source={pixelated} uniforms={uniforms} />
                  </sk.Paint>
                ) : undefined
              }
            >
              <sk.Picture picture={picture} />
              <sk.Path path={currentPath} paint={paintRef} />
            </sk.Group>
          </sk.Canvas>
        </GestureDetector>
      </View>
      <XStack justifyContent="space-between">
        <XStack gap={'$m'} alignItems="center">
          <IconGroup>
            <ToolbarIcon
              type="Draw"
              isSelected={tool === 'draw'}
              onPress={handlePressDraw}
            />
            <ToolbarIcon
              type="Erase"
              isSelected={tool === 'erase'}
              onPress={handlePressErase}
            />
          </IconGroup>
          <IconGroup>
            <ToolbarIcon
              type="Stop"
              isSelected={size === 'large'}
              onPress={handlePressSizeLarge}
            />
            <ToolbarIcon
              type="Stop"
              isSelected={size === 'small'}
              customSize={[24, 10]}
              onPress={handlePressSizeSmall}
            />
          </IconGroup>
          <IconGroup>
            <ToolbarIcon type="Bang" onPress={handlePressClear} />
          </IconGroup>
        </XStack>
        <Button
          backgroundColor={'$primaryText'}
          borderWidth={0}
          paddingLeft="$m"
          paddingRight={'$l'}
          onPress={handlePressAttach}
          pressStyle={{ backgroundColor: '$secondaryText' }}
        >
          <Icon type="Attachment" color="$background" size="$m" />
          <Button.Text color="$background">Attach</Button.Text>
        </Button>
      </XStack>
    </YStack>
  );
};

const IconGroup = styled(XStack, {
  borderColor: '$border',
  borderWidth: 1,
  alignItems: 'center',
  borderRadius: '$s',
  overflow: 'hidden',
});

const ToolbarIcon = styled(Icon, {
  width: '$3xl',
  height: '$3xl',
  color: '$tertiaryText',
  variants: {
    isSelected: {
      true: {
        color: '$primaryText',
        borderColor: '$activeBorder',
        backgroundColor: '$secondaryBackground',
      },
    },
  } as const,
});

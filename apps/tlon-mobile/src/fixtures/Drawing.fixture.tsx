import * as sk from '@shopify/react-native-skia';
import { Skia } from '@shopify/react-native-skia';
import { Text, View } from '@tloncorp/ui';
import { current } from 'immer';
import { useCallback, useEffect, useRef, useState } from 'react';
import { PixelRatio, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { interpolate, runOnJS, useSharedValue } from 'react-native-reanimated';

import { FixtureWrapper } from './FixtureWrapper';

const pd = PixelRatio.get();

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

const DrawingCanvasFixture = () => {
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

  return (
    <FixtureWrapper fillHeight fillWidth>
      <View flex={1} justifyContent="center" alignItems="center">
        <View flexDirection="row" gap={2}>
          <Text onPress={() => setTool('draw')}>Draw</Text>
          <Text onPress={() => setTool('erase')}>Erase</Text>
          <Text onPress={() => setSize('small')}>Small</Text>
          <Text onPress={() => setSize('large')}>Large</Text>
        </View>
        <GestureDetector gesture={pan}>
          <sk.Canvas
            ref={canvasRef}
            style={{
              width: 256,
              height: 142,
              borderWidth: 1,
              borderColor: 'black',
            }}
          >
            <sk.Group
              layer={
                <sk.Paint>
                  <sk.RuntimeShader source={pixelated} uniforms={uniforms} />
                </sk.Paint>
              }
            >
              <sk.Picture picture={picture} />

              <sk.Path path={currentPath} paint={paintRef} />
            </sk.Group>
          </sk.Canvas>
        </GestureDetector>
      </View>
    </FixtureWrapper>
  );
};

export default () => <DrawingCanvasFixture />;

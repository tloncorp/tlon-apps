import { ForwardingProps, Sheet } from '@tloncorp/ui';
import {
  ComponentProps,
  ComponentRef,
  useCallback,
  useEffect,
  useRef,
} from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AudioRecorder } from './AudioRecorder';

export function AudioRecorderSheet({
  audioRecorderProps,
  onOpenChange: onOpenChangeProp,
  ...forwardedProps
}: ForwardingProps<
  typeof Sheet,
  {
    audioRecorderProps: ComponentProps<typeof AudioRecorder>;
  }
>) {
  const safeAreaInsets = useSafeAreaInsets();
  const audioRecorderRef = useRef<ComponentRef<typeof AudioRecorder> | null>(
    null
  );

  const onAnyOpenChange = useCallback(
    (open: boolean) => {
      onOpenChangeProp?.(open);

      if (open) {
        // automatically start recording whenever opened
        audioRecorderRef.current?.startRecording();
      } else {
        audioRecorderRef.current?.stopRecording();
        audioRecorderRef.current?.stopPlayback();
      }

      if (!open) {
        // delay until sheet is likely closed
        setTimeout(() => {
          audioRecorderRef.current?.enterRecordingMode();
        }, 200);
      }
    },
    [onOpenChangeProp]
  );

  // `onOpenChange` does not fire when `open` prop changes - call the callback
  // manually.
  useEffect(() => {
    onAnyOpenChange(forwardedProps.open ?? false);
  }, [forwardedProps.open, onAnyOpenChange]);

  return (
    <Sheet
      animation="simple"
      modal
      dismissOnOverlayPress={false}
      {...forwardedProps}
      onOpenChange={onAnyOpenChange}
    >
      <Sheet.Overlay animation="simple" />
      <Sheet.Frame
        borderRadius="$3.5xl"
        backgroundColor="$background"
        paddingVertical={40}
        justifyContent="center"
        paddingBottom={safeAreaInsets.bottom}
      >
        <AudioRecorder
          {...audioRecorderProps}
          ref={(elm) => {
            audioRecorderRef.current = elm;

            const { ref } = audioRecorderProps;
            if (ref != null) {
              if (typeof ref === 'string') {
                throw new Error('String refs are not supported');
              }
              if (typeof ref === 'function') {
                ref(elm);
              } else {
                // @ts-expect-error - need to write to readonly property `current`
                ref.current = elm;
              }
            }
          }}
        />
      </Sheet.Frame>
    </Sheet>
  );
}

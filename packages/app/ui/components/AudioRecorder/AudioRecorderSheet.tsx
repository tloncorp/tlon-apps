import { View } from '@tloncorp/ui';
import {
  ComponentProps,
  ComponentRef,
  useCallback,
  useEffect,
  useRef,
} from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BottomSheetWrapper } from '../BottomSheetWrapper';
import { BottomSheetWrapperProps } from '../BottomSheetWrapper.types';
import { AudioRecorder } from './AudioRecorder';

type AudioRecorderSheetProps = Omit<
  BottomSheetWrapperProps,
  'children' | 'onOpenChange'
> & {
  audioRecorderProps: ComponentProps<typeof AudioRecorder>;
  disableDrag?: boolean;
  onOpenChange?: (open: boolean) => void;
};

export function AudioRecorderSheet({
  audioRecorderProps,
  onOpenChange: onOpenChangeProp,
  disableDrag = false,
  ...forwardedProps
}: AudioRecorderSheetProps) {
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
    <BottomSheetWrapper
      {...forwardedProps}
      onOpenChange={onAnyOpenChange}
      enablePanDownToClose={!disableDrag}
      dismissOnSnapToBottom={!disableDrag}
      showHandle={!disableDrag}
      showOverlay
    >
      <View
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
                ref.current = elm;
              }
            }
          }}
        />
      </View>
    </BottomSheetWrapper>
  );
}

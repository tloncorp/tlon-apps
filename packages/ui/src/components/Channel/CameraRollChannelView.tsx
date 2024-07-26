import {
  NativeStackNavigationProp,
  createNativeStackNavigator,
} from '@react-navigation/native-stack';
import { extractContentTypesFromPost } from '@tloncorp/shared/dist';
import * as db from '@tloncorp/shared/dist/db';
import * as ub from '@tloncorp/shared/dist/urbit';
import { CameraView } from 'expo-camera';
import { useCameraPermissions } from 'expo-image-picker';
import {
  ComponentProps,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ChevronLeft } from '../../assets/icons';
import { AttachmentProvider, useAttachmentContext } from '../../contexts';
import { Image, Spinner, Text } from '../../core';
import { View, XStack } from '../../core';
import { Button } from '../Button';
import { Icon } from '../Icon';
import { IconButton } from '../IconButton';
import { Channel } from './index';

type CameraRollStackParamList = {
  Camera: undefined;
  Gallery: undefined;
};
const CameraRollStack = createNativeStackNavigator<CameraRollStackParamList>();
const cameraRollContext = createContext<ComponentProps<typeof Channel>>(
  {} as unknown as ComponentProps<typeof Channel>
);

export function CameraRollChannelView(props: ComponentProps<typeof Channel>) {
  return (
    <AttachmentProvider
      canUpload={props.canUpload}
      uploadAsset={props.uploadAsset}
    >
      <cameraRollContext.Provider value={props}>
        <CameraRollStack.Navigator
          initialRouteName="Camera"
          screenOptions={{ headerShown: false }}
        >
          <CameraRollStack.Screen
            name="Camera"
            options={{ headerShown: false }}
            component={CameraRollCameraView}
          />
          <CameraRollStack.Screen
            name="Gallery"
            component={CameraRollGallery}
          />
        </CameraRollStack.Navigator>
      </cameraRollContext.Provider>
    </AttachmentProvider>
  );
}

function CameraRollCameraView({
  navigation,
}: {
  navigation: NativeStackNavigationProp<CameraRollStackParamList>;
}) {
  const { bottom } = useSafeAreaInsets();
  const { channel, messageSender, posts, goBack } =
    useContext(cameraRollContext);
  const handlePressGallery = useCallback(() => {
    navigation.navigate('Gallery');
  }, []);

  const cameraViewRef = useRef<CameraView>(null);
  const {
    attachAssets,
    attachments,
    clearAttachments,
    waitForAttachmentUploads,
  } = useAttachmentContext();
  const [isCapturing, setIsCapturing] = useState(false);
  const [isAttaching, setIsAttaching] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const handlePressTakePhoto = useCallback(() => {
    setIsCapturing(true);
    cameraViewRef.current
      ?.takePictureAsync({
        scale: 0.5,
        quality: 0.7,
      })
      .then((result) => {
        if (result) {
          attachAssets([
            {
              uri: result.uri,
              width: result.width,
              height: result.height,
            },
          ]);
          setIsCapturing(false);
          setIsAttaching(true);
        } else {
          console.warn('no result');
        }
      });
  }, []);

  const sendMessage = useCallback(async () => {
    setIsAttaching(false);
    setIsSending(true);
    const uploads = await waitForAttachmentUploads();
    clearAttachments();
    const image = uploads[0];
    if (!image || image.type !== 'image') {
      console.warn('failed to find attachment');
      return;
    }
    messageSender(
      [
        {
          block: {
            image: {
              src: image.uploadState.remoteUri,
              width: image.file.width,
              height: image.file.height,
              alt: 'camera photo',
            },
          },
        },
      ],
      channel.id
    );
    setTimeout(() => {
      setIsSending(false);
    }, 100);
  }, [channel.id, clearAttachments, messageSender, waitForAttachmentUploads]);

  useEffect(() => {
    if (attachments.length > 0 && isAttaching) {
      sendMessage();
    }
  }, [attachments, isAttaching, sendMessage]);
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const request = useRef(false);

  useLayoutEffect(() => {
    if (!permission?.granted && !request.current) {
      requestPermission();
      request.current = true;
    }
  }, [permission?.granted, requestPermission]);

  if (!permission) {
    return <View flex={1} backgroundColor="$black" />;
  } else if (!permission.granted) {
    return (
      <View
        flex={1}
        alignItems={'center'}
        justifyContent="center"
        backgroundColor="$black"
      >
        <Button.Text color="$gray300">
          Grant permission to use the camera.
        </Button.Text>
      </View>
    );
  }

  return (
    <View flex={1}>
      <CameraView ref={cameraViewRef} style={{ flex: 1 }} />
      <XStack
        position="absolute"
        bottom={bottom + 50}
        width="100%"
        left={0}
        paddingHorizontal="$2xl"
        alignItems="center"
        justifyContent="space-between"
      >
        <CameraRollPostPreview
          borderColor="$border"
          borderWidth={1}
          post={posts?.[0]}
          overflow="hidden"
          width="$3xl"
          height="$3xl"
          borderRadius={'$m'}
          onPress={handlePressGallery}
        />
        <View
          width={'$6xl'}
          height={'$6xl'}
          borderRadius={500}
          backgroundColor={'$background'}
          onPress={handlePressTakePhoto}
          disabled={isAttaching || isSending || isCapturing}
          pressStyle={{
            transform: [{ scale: 0.9 }],
            backgroundColor: '$secondaryBackground',
          }}
        />
        <View width="$4xl" height="$4xl" borderRadius={'$m'}></View>
      </XStack>

      {isCapturing || isAttaching || isSending ? (
        <View
          position="absolute"
          width="100%"
          height="100%"
          top={0}
          left={0}
          alignItems="center"
          justifyContent="center"
        >
          <Spinner />
        </View>
      ) : null}
      {goBack && (
        <View
          onPress={goBack}
          position="absolute"
          top={insets.top}
          left={'$xl'}
          width={100}
          height={100}
          // backgroundColor={'transparent'}
        >
          <Icon type="ChevronLeft" size="$l" color="$background" />
        </View>
      )}
    </View>
  );
}

function CameraRollPostPreview({
  post,
  ...props
}: { post?: db.Post } & ComponentProps<typeof View>) {
  const image = useMemo(() => {
    if (!post) return null;
    const parsedContent = extractContentTypesFromPost(post);
    return parsedContent.blocks.find((b): b is ub.Image => 'image' in b);
  }, [post]);

  return (
    <View {...props}>
      {image && (
        <Image
          width={'100%'}
          aspectRatio={1}
          source={{ uri: image.image.src }}
        />
      )}
    </View>
  );
}

function CameraRollGallery({
  navigation,
}: {
  navigation: NativeStackNavigationProp<CameraRollStackParamList>;
}) {
  const ctx = useContext(cameraRollContext);
  return <Channel {...ctx} goBack={() => navigation.goBack()} />;
}

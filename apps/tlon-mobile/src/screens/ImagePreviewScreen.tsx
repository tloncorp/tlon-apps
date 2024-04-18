import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ImagePreviewScreenView } from '@tloncorp/ui/src';
import { useCallback } from 'react';

import type { HomeStackParamList } from '../types';

type ImagePreviewScreenProps = NativeStackScreenProps<
  HomeStackParamList,
  'ImagePreview'
>;

export default function ImagePreviewScreen(props: ImagePreviewScreenProps) {
  const sourceParam = props.route.params.source;

  useFocusEffect(
    useCallback(() => {
      const parent = props.navigation.getParent();
      if (parent) {
        parent.setOptions({
          tabBarStyle: { opacity: 0 },
        });
      }

      return () => {
        if (parent) {
          parent.setOptions({
            tabBarStyle: { opacity: 1 },
          });
        }
      };
    }, [props.navigation])
  );

  return (
    <ImagePreviewScreenView
      source={sourceParam}
      goBack={() => props.navigation.pop()}
    />
  );
}

import { useEffect, useState } from 'react';
import { Platform, useWindowDimensions } from 'react-native';
import { Text } from '@tloncorp/ui';
import { Pressable } from '@tloncorp/ui';
import * as DocumentPicker from 'expo-document-picker';
import { YStack } from 'tamagui';

import { BucketFileViewer } from '../ui/components/BucketsChannel/BucketFileViewer';
import { FixtureWrapper } from './FixtureWrapper';
import { HEIC_SAMPLE_URI } from './heicSample';

const nativeSample = {
  name: 'buckets-preview.heic',
  uri: HEIC_SAMPLE_URI,
  mimeType: 'application/octet-stream',
  sizeLabel: 'HEIC test image',
};

function NativeHeicPreviewFixture() {
  const [item, setItem] = useState(nativeSample);
  const [error, setError] = useState<string>();
  const chooseFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;
      const asset = result.assets[0];
      setError(undefined);
      setItem({
        name: asset.name,
        uri: asset.uri,
        mimeType: asset.mimeType ?? 'application/octet-stream',
        sizeLabel: `${asset.size ?? 0} bytes`,
      });
    } catch {
      setError('Could not open the file picker. Please try again.');
    }
  };
  return (
    <FixtureWrapper fillHeight fillWidth safeArea>
      <YStack flex={1} width="100%">
        <YStack padding="$m" gap="$s">
          <Text>Native HEIC preview — nothing is uploaded.</Text>
          <Pressable onPress={chooseFile} padding="$m">
            <Text>Choose file</Text>
          </Pressable>
          {error ? <Text>{error}</Text> : null}
        </YStack>
        <BucketFileViewer item={item} onClose={() => setItem(nativeSample)} />
      </YStack>
    </FixtureWrapper>
  );
}

function HeicPreviewFixture() {
  const { height } = useWindowDimensions();
  const [file, setFile] = useState<File>();
  const [uri, setUri] = useState('/fixtures/buckets-preview.heic');
  useEffect(() => {
    return () => {
      if (uri.startsWith('blob:')) URL.revokeObjectURL(uri);
    };
  }, [uri]);
  return (
    <FixtureWrapper fillHeight fillWidth>
      <YStack height={height} width="100%">
        <YStack padding="$m" gap="$s">
          <Text>
            Choose a HEIC photo to preview locally. Nothing is uploaded.
          </Text>
          <input
            aria-label="Choose HEIC photo"
            type="file"
            accept=".heic,.heif,image/heic,image/heif"
            onChange={(event) => {
              const selected = event.target.files?.[0];
              if (!selected) return;
              setFile(selected);
              setUri(URL.createObjectURL(selected));
            }}
          />
        </YStack>
        <BucketFileViewer
          item={{
            name: file?.name ?? 'buckets-preview.heic',
            uri,
            mimeType: file?.type || 'application/octet-stream',
            sizeLabel: file ? `${file.size} bytes` : 'Test image',
          }}
          onClose={() => {
            setFile(undefined);
            setUri('/fixtures/buckets-preview.heic');
          }}
          onOpenExternally={() =>
            window.open(uri, '_blank', 'noopener,noreferrer')
          }
        />
      </YStack>
    </FixtureWrapper>
  );
}

export default {
  'HEIC photo':
    Platform.OS === 'web' ? (
      <HeicPreviewFixture />
    ) : (
      <NativeHeicPreviewFixture />
    ),
};

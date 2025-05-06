import {
  extractContentTypesFromPost,
  getRichLinkMetadata,
  isRichLinkPost,
  useDebouncedValue,
} from '@tloncorp/shared';
import * as db from '@tloncorp/shared/db';
import * as store from '@tloncorp/shared/store';
import * as ub from '@tloncorp/shared/urbit';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScrollView, View, useTheme } from 'tamagui';

import { KeyboardAvoidingView } from '../..';
import { useRegisterChannelHeaderItem } from '../Channel/ChannelHeader';
import {
  ControlledImageField,
  ControlledTextField,
  ControlledTextareaField,
  FormFrame,
} from '../Form';
import { ScreenHeader } from '../ScreenHeader';

export type LinkInputSaveParams = { block: ub.LinkBlock; meta: ub.Metadata };

interface LinkInputProps {
  editingPost?: db.Post;
  isPosting?: boolean;
  onSave: ({ block, meta }: LinkInputSaveParams) => void;
}

export function LinkInput({ editingPost, isPosting, onSave }: LinkInputProps) {
  const [status, setStatus] = useState<
    'idle' | 'loading' | 'success' | 'error'
  >('idle');
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const initialValues = useMemo(() => {
    if (!editingPost) {
      return null;
    }

    if (!isRichLinkPost(editingPost)) {
      return null;
    }

    const { blocks } = extractContentTypesFromPost(editingPost);
    return getRichLinkMetadata(blocks[0]);
  }, [editingPost]);

  const {
    control,
    watch,
    handleSubmit,
    setValue,
    formState: { isDirty, isValid, errors },
  } = useForm({
    mode: 'onChange',
    defaultValues: {
      url: initialValues?.url || '',
      title: initialValues?.title || '',
      // image: initialValues?.image || '',
      description: initialValues?.description || '',
    },
  });

  const form = watch();
  const url = useDebouncedValue(form.url, 500);
  const { data, isLoading } = store.useLinkGrabber(url);
  useEffect(() => {
    if (data && data.type === 'page') {
      if (form.title === '') {
        setValue('title', data.title || '', {
          shouldDirty: true,
        });
      }

      if (form.description === '') {
        setValue('description', data.description || '', {
          shouldDirty: true,
        });
      }
    }
  }, [data, form]);

  const handlePressDone = useCallback(() => {
    if (isDirty && isValid) {
      handleSubmit((formData) => {
        if (!data) {
          onSave({
            block: { link: { url: formData.url, meta: {} } },
            meta: {
              title: formData.title,
              description: formData.description,
              image: '',
              cover: '',
            },
          });
        } else if (data.type === 'file') {
          const { isImage, mime } = data;
          const block: ub.LinkBlock = {
            link: {
              url: formData.url,
              meta: {
                mime,
              },
            },
          };
          onSave({
            block,
            meta: {
              title: formData.title,
              description: formData.description,
              image: isImage ? data.url : '',
              cover: '',
            },
          });
        } else {
          const { url, type, ...meta } = data;
          const block: ub.LinkBlock = {
            link: {
              url: formData.url,
              meta,
            },
          };
          const image = data.previewImageUrl || data.siteIconUrl || '';
          onSave({
            block,
            meta: {
              title: formData.title,
              description: formData.description,
              image,
              cover: '',
            },
          });
        }
      })();
    }
  }, [handleSubmit, isDirty, isValid, onSave]);

  console.log('LinkInput', {
    isPosting,
    isValid,
    isDirty,
  });

  useRegisterChannelHeaderItem(
    useMemo(
      () => (
        <ScreenHeader.TextButton
          key="gallery-preview-post"
          onPress={handlePressDone}
          disabled={!isValid || isLoading || isPosting}
          testID="GalleryPostButton"
        >
          {isPosting ? 'Posting...' : editingPost ? 'Save' : 'Post'}
        </ScreenHeader.TextButton>
      ),
      [handlePressDone, isPosting, editingPost, isValid]
    )
  );

  return (
    <View flex={1} backgroundColor={theme.background.val}>
      <KeyboardAvoidingView>
        <ScrollView
          keyboardDismissMode="on-drag"
          flex={1}
          contentContainerStyle={{
            width: '100%',
            maxWidth: 600,
            marginHorizontal: 'auto',
          }}
        >
          <FormFrame paddingBottom={insets.bottom + 20}>
            <ControlledTextField
              name="url"
              label="URL"
              control={control}
              inputProps={{
                autoFocus: true,
                placeholder: 'https://example.com',
                autoCapitalize: 'none',
                keyboardType: 'url',
                testID: 'LinkUrlInput',
              }}
              rules={{
                required: 'URL is required',
                pattern: {
                  value:
                    /^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})([\/\w .-]*)*\/?$/,
                  message: 'Please enter a valid URL',
                },
              }}
            />

            <ControlledTextField
              name="title"
              label="Title"
              control={control}
              inputProps={{
                placeholder: 'Link title',
                testID: 'LinkTitleInput',
              }}
              rules={{
                maxLength: {
                  value: 100,
                  message: 'Title is limited to 100 characters',
                },
              }}
            />

            {/* <ControlledImageField
              label="Preview image"
              name="image"
              hideError={true}
              control={control}
              inputProps={{
                buttonLabel: 'Change preview image',
              }}
              rules={{
                pattern: {
                  value: /^(?!file).+/,
                  message: 'Image has not finished uploading',
                },
              }}
            /> */}

            <ControlledTextareaField
              name="description"
              label="Description"
              control={control}
              inputProps={{
                placeholder: 'Describe this link...',
                numberOfLines: 3,
                multiline: true,
                testID: 'LinkDescriptionInput',
              }}
              rules={{
                maxLength: {
                  value: 240,
                  message: 'Description is limited to 240 characters',
                },
              }}
            />
          </FormFrame>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

import {
  extractContentTypesFromPost,
  getRichLinkMetadata,
  isRichLinkPost,
  isTrustedEmbed,
  isValidUrl,
  useDebouncedValue,
} from '@tloncorp/shared';
import * as db from '@tloncorp/shared/db';
import * as store from '@tloncorp/shared/store';
import * as ub from '@tloncorp/shared/urbit';
import { Text } from '@tloncorp/ui';
import { useCallback, useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScrollView, View, useTheme } from 'tamagui';

import {
  KeyboardAvoidingView,
  LoadingSpinner,
  createContentRenderer,
} from '../..';
import { useRegisterChannelHeaderItem } from '../Channel/ChannelHeader';
import {
  ControlledTextField,
  ControlledTextareaField,
  FormFrame,
} from '../Form';
import { BlockData } from '../PostContent/contentUtils';
import { ScreenHeader } from '../ScreenHeader';

export type LinkInputSaveParams = { block: ub.Block; meta: ub.Metadata };

interface LinkInputProps {
  editingPost?: db.Post;
  isPosting?: boolean;
  onSave: ({ block, meta }: LinkInputSaveParams) => void;
}

const TITLE_MAX_LENGTH = 240;
const DESCRIPTION_MAX_LENGTH = 580;

const PostRenderer = createContentRenderer({
  blockSettings: {
    link: {
      aspectRatio: 1.5,
    },
  },
});

export function LinkInput({ editingPost, isPosting, onSave }: LinkInputProps) {
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
    formState: { isDirty, isValid },
  } = useForm({
    mode: 'onChange',
    defaultValues: {
      url: initialValues?.url || '',
      title: initialValues?.title || '',
      description: initialValues?.description || '',
    },
  });

  const form = watch();
  const url = useDebouncedValue(form.url, 500);
  const { data, isLoading } = store.useLinkGrabber(url);
  const hasIssue = data && (data.type === 'error' || data.type === 'redirect');
  const isEmbed = useMemo(() => {
    return isTrustedEmbed(url);
  }, [url]);

  useEffect(() => {
    if (data && data.type === 'page') {
      const newTitle = data.title || '';
      if (form.title === '' && newTitle !== form.title) {
        setValue('title', data.title || '', {
          shouldTouch: true,
          shouldDirty: true,
          shouldValidate: true,
        });
      }

      const newDescription = data.description || '';
      if (form.description === '' && newDescription !== form.description) {
        setValue('description', newDescription, {
          shouldTouch: true,
          shouldDirty: true,
          shouldValidate: true,
        });
      }
    }
  }, [data, form]);

  const block: BlockData | null = useMemo(() => {
    if (!data || hasIssue) {
      if (isEmbed) {
        return {
          type: 'embed',
          url,
        };
      }

      return null;
    }
    if (data.type === 'file') {
      if (data.isImage) {
        return {
          type: 'image',
          src: data.url,
          height: 300,
          width: 300,
          alt: '',
        };
      }

      return {
        ...data,
        type: 'link',
      };
    }

    const { url: retrievedUrl, type, ...meta } = data;
    if (isEmbed) {
      return {
        type: 'embed',
        url,
      };
    }

    return {
      ...meta,
      type: 'link',
      url,
    };
  }, [url, data, hasIssue]);

  const handlePressDone = useCallback(() => {
    if (isDirty && isValid) {
      handleSubmit((formData) => {
        if (!data || hasIssue) {
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
  }, [data, hasIssue, isDirty, isValid, handleSubmit, onSave]);

  console.log('LinkInput', {
    block,
    data,
    hasIssue,
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
            {block && <PostRenderer content={[block]} />}
            {hasIssue && !isTrustedEmbed && (
              <View
                padding="$l"
                backgroundColor="$secondaryBackground"
                borderRadius="$m"
                marginBottom="$l"
              >
                <Text color="$secondaryText">Unable to fetch link preview</Text>
              </View>
            )}
            <View>
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
                  paddingRight: '$3xl',
                }}
                rules={{
                  required: 'URL is required',
                  validate: (url) => {
                    return isValidUrl(url) || 'Please enter a valid URL';
                  },
                }}
              />
              {isLoading && (
                <View position="absolute" right="$xl" bottom={18}>
                  <LoadingSpinner size="small" />
                </View>
              )}
            </View>

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
                  value: TITLE_MAX_LENGTH,
                  message: `Title is limited to ${TITLE_MAX_LENGTH} characters`,
                },
              }}
            />

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
                  value: DESCRIPTION_MAX_LENGTH,
                  message: `Description is limited to ${DESCRIPTION_MAX_LENGTH} characters`,
                },
              }}
            />
          </FormFrame>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

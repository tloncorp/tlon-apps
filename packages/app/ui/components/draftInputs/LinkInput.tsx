import {
  BlockData,
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
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScrollView, View, useTheme } from 'tamagui';

import { KeyboardAvoidingView, LoadingSpinner } from '../..';
import { useRegisterChannelHeaderItem } from '../Channel/ChannelHeader';
import {
  ControlledTextField,
  ControlledTextareaField,
  FormFrame,
} from '../Form';
import { createContentRenderer } from '../PostContent/ContentRenderer';
import { ScreenHeader } from '../ScreenHeader';

export type LinkInputSaveParams = {
  content: ub.Block | ub.Inline;
  meta: ub.Metadata;
};

interface LinkInputProps {
  editingPost?: db.Post;
  isPosting?: boolean;
  onSave: ({ content, meta }: LinkInputSaveParams) => void;
}

const TITLE_MAX_LENGTH = 240;
const DESCRIPTION_MAX_LENGTH = 580;

const PostRenderer = createContentRenderer({
  blockSettings: {
    link: {
      imageProps: {
        width: '100%',
      },
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

  const lastPreloadedRef = useRef<{
    title: string | null;
    description: string | null;
  }>({ title: null, description: null });

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
  // We need to track debounce dirty state to appropriately disable the send button. useLinkGrabber's
  // loading state will not be set until the debounce fires.
  const [isPendingDebounce, setIsPendingDebounce] = useState(false);
  useEffect(() => {
    setIsPendingDebounce(form.url !== url);
  }, [form.url, url]);
  const { data, isLoading } = store.useLinkGrabber(url);
  const hasIssue = data && (data.type === 'error' || data.type === 'redirect');
  const isEmbed = useMemo(() => {
    return isTrustedEmbed(url);
  }, [url]);

  useEffect(() => {
    if (data && data.type === 'page') {
      const newTitle = data.title || '';
      if (
        form.title === '' &&
        newTitle !== form.title &&
        lastPreloadedRef.current?.title !== data.title
      ) {
        lastPreloadedRef.current.title = newTitle;
        setValue('title', newTitle, {
          shouldTouch: true,
          shouldDirty: true,
          shouldValidate: true,
        });
      }

      const newDescription = data.description || '';
      if (
        form.description === '' &&
        newDescription !== form.description &&
        lastPreloadedRef.current?.description !== data.description
      ) {
        lastPreloadedRef.current.description = newDescription;
        setValue('description', newDescription, {
          shouldTouch: true,
          shouldDirty: true,
          shouldValidate: true,
        });
      }
    }
  }, [data, form, setValue]);

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

      const fileType = data.mime.split('/')[1];
      const fileName = data.url.split('/').pop();

      return {
        type: 'link',
        url: data.url,
        title: fileName,
        description: fileType,
      };
    }

    const { url: retrievedUrl, type, ...meta } = data;
    return {
      ...meta,
      type: 'link',
      url,
    };
  }, [data, hasIssue, isEmbed, url]);

  const handlePressDone = useCallback(() => {
    if (isDirty && isValid) {
      handleSubmit((formData) => {
        const defaultMeta = {
          title: formData.title,
          description: formData.description,
          image: '',
          cover: '',
        };

        if (!block) {
          return onSave({
            content: {
              link: {
                url: formData.url,
                meta: {},
              },
            },
            meta: defaultMeta,
          });
        }

        if (block.type === 'embed') {
          return onSave({
            content: {
              link: {
                href: block.url,
                content: block.url,
              },
            },
            meta: defaultMeta,
          });
        }

        if (block.type === 'image') {
          return onSave({
            content: {
              image: {
                src: block.src,
                height: block.height,
                width: block.width,
                alt: block.alt,
              },
            },
            meta: {
              ...defaultMeta,
              image: block.src,
            },
          });
        }

        const { url, type, ...meta } = block;
        return onSave({
          content: {
            link: {
              url,
              meta,
            },
          },
          meta: {
            ...defaultMeta,
            image: block.previewImageUrl || block.siteIconUrl || '',
          },
        });
      })();
    }
  }, [isDirty, isValid, handleSubmit, block, onSave]);

  useRegisterChannelHeaderItem(
    useMemo(
      () => (
        <ScreenHeader.TextButton
          key="gallery-preview-post"
          onPress={handlePressDone}
          disabled={!isValid || isPendingDebounce || isLoading || isPosting}
          testID="GalleryPostButton"
        >
          {isPosting ? 'Posting...' : editingPost ? 'Save' : 'Post'}
        </ScreenHeader.TextButton>
      ),
      [
        handlePressDone,
        isValid,
        isPendingDebounce,
        isLoading,
        isPosting,
        editingPost,
      ]
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
            {hasIssue && !isEmbed && (
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

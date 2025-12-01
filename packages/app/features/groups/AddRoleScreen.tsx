import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { generateSafeId } from '@tloncorp/shared/logic';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Alert, Keyboard } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useGroupContext } from '../../hooks/useGroupContext';
import { GroupSettingsStackParamList } from '../../navigation/types';
import {
  ActionSheet,
  Button,
  Field,
  ListItem,
  Pressable,
  ScreenHeader,
  ScrollView,
  TextInput,
  View,
  YStack,
} from '../../ui';
import { Badge } from '../../ui/components/Badge';

type Props = NativeStackScreenProps<GroupSettingsStackParamList, 'AddRole'>;

type RoleFormData = {
  title: string;
  description: string;
};

export function AddRoleScreen({ navigation, route }: Props) {
  const { groupId } = route.params;
  const { bottom } = useSafeAreaInsets();
  const isSavingRef = useRef(false);

  const { createGroupRole, addUserToRole } = useGroupContext({
    groupId,
  });

  const {
    reset,
    control,
    handleSubmit,
    formState: { errors, isValid, isDirty },
    trigger,
  } = useForm<RoleFormData>({
    defaultValues: {
      title: '',
      description: '',
    },
  });

  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);

  // Update selectedMembers when returning from SelectRoleMembers screen
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      // If we're returning from member selection, the route params will have updated selectedMembers
      if (route.params.selectedMembers) {
        setSelectedMembers(route.params.selectedMembers);
      }
    });

    return unsubscribe;
  }, [navigation, route.params.selectedMembers]);

  const hasUnsavedChanges = isDirty || selectedMembers.length > 0;

  // Intercept back navigation to prompt for unsaved changes
  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (e) => {
      // If no unsaved changes or already saving, let navigation proceed
      if (!hasUnsavedChanges || isSavingRef.current) {
        return;
      }

      // Prevent default behavior of leaving the screen
      e.preventDefault();

      // Prompt the user before leaving the screen
      Alert.alert(
        'Discard changes?',
        'You have unsaved changes. Are you sure you want to discard them?',
        [
          { text: "Don't leave", style: 'cancel', onPress: () => {} },
          {
            text: 'Discard',
            style: 'destructive',
            onPress: () => navigation.dispatch(e.data.action),
          },
        ]
      );
    });

    return unsubscribe;
  }, [navigation, hasUnsavedChanges]);

  const handleGoBack = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  const handleSave = useCallback(
    async (data: { title: string; description: string }) => {
      if (!data.title) {
        return;
      }
      isSavingRef.current = true;

      const roleId = generateSafeId(data.title, 'role');
      await createGroupRole({
        id: roleId,
        title: data.title,
        description: data.description,
      });
      // Add selected members to the role
      for (const contactId of selectedMembers) {
        await addUserToRole(contactId, roleId);
      }
      reset();
      setSelectedMembers([]);
      navigation.goBack();
    },
    [createGroupRole, addUserToRole, selectedMembers, reset, navigation]
  );

  const handleNavigateToMemberSelector = useCallback(() => {
    navigation.navigate('SelectRoleMembers', {
      groupId,
      selectedMembers,
      onSave: (members: string[]) => {
        setSelectedMembers(members);
      },
    });
  }, [navigation, groupId, selectedMembers]);

  return (
    <View flex={1} backgroundColor="$secondaryBackground">
      <ScreenHeader backAction={handleGoBack} title="Add role" />
      <ScrollView
        flex={1}
        contentContainerStyle={{
          padding: '$l',
          paddingTop: '$xl',
          paddingBottom: bottom,
        }}
      >
        <YStack gap="$l">
          <Controller
            control={control}
            name="title"
            rules={{ required: 'Role title is required' }}
            render={({ field: { onChange, onBlur, value } }) => (
              <Field label="Title" error={errors.title?.message}>
                <TextInput
                  placeholder="Role title"
                  onChangeText={onChange}
                  onBlur={() => {
                    onBlur();
                    trigger('title');
                    Keyboard.dismiss();
                  }}
                  value={value}
                  testID="RoleTitleInput"
                />
              </Field>
            )}
          />
          <Controller
            control={control}
            name="description"
            render={({ field: { onChange, onBlur, value } }) => (
              <Field label="Description">
                <TextInput
                  placeholder="Role description"
                  onChangeText={onChange}
                  onBlur={() => {
                    onBlur();
                    Keyboard.dismiss();
                  }}
                  value={value}
                  testID="RoleDescriptionInput"
                />
              </Field>
            )}
          />
          <Pressable onPress={handleNavigateToMemberSelector}>
            <ListItem
              paddingHorizontal="$2xl"
              backgroundColor="$background"
              borderRadius="$xl"
            >
              <ListItem.MainContent>
                <ListItem.Title>Members</ListItem.Title>
              </ListItem.MainContent>

              <ListItem.EndContent
                flexDirection="row"
                gap="$xl"
                alignItems="center"
              >
                {selectedMembers.length > 0 ? (
                  <ListItem.Count
                    notified={false}
                    count={selectedMembers.length}
                  />
                ) : (
                  <Badge text="Add" />
                )}
                <ActionSheet.ActionIcon
                  type="ChevronRight"
                  color="$tertiaryText"
                />
              </ListItem.EndContent>
            </ListItem>
          </Pressable>
          <Button hero onPress={handleSubmit(handleSave)} disabled={!isValid}>
            <Button.Text>Save</Button.Text>
          </Button>
        </YStack>
      </ScrollView>
    </View>
  );
}

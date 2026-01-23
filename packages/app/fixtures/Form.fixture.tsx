import React, { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, IconType, ScrollView, View } from '../ui';
import * as Form from '../ui/components/Form';
import { FixtureWrapper } from './FixtureWrapper';

const FormFixture = () => {
  const insets = useSafeAreaInsets();
  const { control, reset } = useForm({
    mode: 'onChange',
    defaultValues: {
      title: '',
      description: '',
      number: 'one',
      listItem: 'chat',
      image: undefined,
      textarea: undefined,
    },
  });

  const formRules = useMemo(() => {
    return { maxLength: { value: 5, message: 'Noooo too long' } };
  }, []);

  const options: Form.RadioInputOption<string>[] = [
    { title: 'One', value: 'one', description: 'This is one things' },
    {
      title: 'Two',
      value: 'two',
      description: 'This is two things',
      disabled: true,
    },
    { title: 'Three', value: 'three', description: 'This is three things' },
  ];

  const listOptions: Form.ListItemInputOption<
    'chat' | 'notebook' | 'gallery'
  >[] = [
    {
      title: 'Chat',
      subtitle: 'A simple, standard text chat',
      value: 'chat',
      icon: 'ChannelTalk',
    },
    {
      title: 'Notebook',
      subtitle: 'Longform publishing and discussion',
      value: 'notebook',
      icon: 'ChannelNotebooks',
    },
    {
      title: 'Gallery',
      subtitle: 'Gather, connect, and arrange rich media',
      value: 'gallery',
      icon: 'ChannelGalleries',
    },
  ];
  const [selectedToggleGroupOption, setSelectedToggleGroupOptions] =
    useState('chat');

  const toggleGroupOptions: { label: string; value: string }[] = [
    { label: 'Chat', value: 'chat' },
    { label: 'Notebook', value: 'notebook' },
    { label: 'Gallery', value: 'gallery' },
    { label: 'And', value: '0' },
    { label: 'More', value: '1' },
    { label: 'Items', value: '2' },
  ];

  return (
    <ScrollView flex={1} contentContainerStyle={{ paddingTop: insets.top }}>
      <Form.FormFrame backgroundType="secondary">
        <Form.ControlledImageField
          name={'image'}
          label="Image"
          control={control}
          inputProps={{ buttonLabel: 'Upload bttton' }}
        />
        <Form.ControlledTextField
          name={'title'}
          label="Title"
          control={control}
          rules={formRules}
          inputProps={{ icon: 'Search', placeholder: 'Type here' }}
        />
        <Form.ControlledRadioField
          options={options}
          name={'number'}
          label="Number"
          control={control}
        />
        <Form.ControlledListItemField
          options={listOptions}
          name="listItem"
          label="List input"
          control={control}
        />

        <Form.ControlledTextareaField
          name="textarea"
          label="Textarea"
          control={control}
          inputProps={{
            placeholder: 'Put some text here',
            numberOfLines: 5,
            multiline: true,
          }}
          rules={{
            maxLength: {
              value: 300,
              message: 'Bug report notes are limited to 300 characters',
            },
          }}
        />

        <Form.Field label="Toggle group">
          <Form.ToggleGroupInput
            value={selectedToggleGroupOption}
            onChange={setSelectedToggleGroupOptions}
            options={toggleGroupOptions}
          />
        </Form.Field>
        <Form.Field required error="Bad thing happen" label="My label">
          <Form.TextInput placeholder="Type here" />
        </Form.Field>

        <Form.Field label="Button input">
          <Button
            fill="outline"
            type="secondary"
            onPress={() =>
              reset({
                title: 'monk',
                description: '',
              })
            }
            label="Reseet"
          />
        </Form.Field>

        <Form.Field label="Find Friends">
          <Form.TextInput
            icon="Search"
            rightControls={
              <Form.TextInput.InnerButton label="Clear" onPress={() => {}} />
            }
          />
        </Form.Field>
      </Form.FormFrame>
    </ScrollView>
  );
};

const accents: Form.Accent[] = ['neutral', 'positive', 'negative'];
const icons: (IconType | undefined)[] = [undefined, 'Search'];
const buttonLabels: (string | undefined)[] = [undefined, 'Clear'];
const backgroundTypes = ['primary', 'secondary'] as const;

export default {
  textInput: (
    <FixtureWrapper fillWidth fillHeight safeArea={true}>
      <ScrollView flex={1}>
        {backgroundTypes.map((backgroundType) => (
          <Form.FormFrame backgroundType={backgroundType} key={backgroundType}>
            {buttonLabels.map((buttonLabel) => (
              <React.Fragment key={buttonLabel ?? 'no-label'}>
                {icons.map((icon) => (
                  <React.Fragment key={icon ?? 'no-icon'}>
                    <Form.FieldLabel paddingVertical="$2xl" margin={0}>
                      {!icon && !buttonLabel
                        ? 'Default'
                        : icon && !buttonLabel
                          ? 'Icon, no button'
                          : !icon && buttonLabel
                            ? 'Button, no icon'
                            : 'Icon and button'}
                    </Form.FieldLabel>
                    <React.Fragment>
                      {accents.map((accent) => (
                        <Form.Field
                          label={`Accent: ${accent}`}
                          accent={accent}
                          error={
                            accent === 'negative'
                              ? 'Bad thing happen'
                              : undefined
                          }
                          key={accent + icon + buttonLabel}
                        >
                          <Form.TextInput
                            icon={icon}
                            placeholder="Type here"
                            rightControls={
                              buttonLabel ? (
                                <Form.TextInput.InnerButton
                                  label={buttonLabel}
                                />
                              ) : undefined
                            }
                          />
                        </Form.Field>
                      ))}
                    </React.Fragment>
                  </React.Fragment>
                ))}
              </React.Fragment>
            ))}
          </Form.FormFrame>
        ))}
      </ScrollView>
    </FixtureWrapper>
  ),
  full: (
    <FixtureWrapper fillWidth fillHeight>
      <FormFixture />
    </FixtureWrapper>
  ),
};

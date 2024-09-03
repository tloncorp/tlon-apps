import { Button, ScrollView } from '@tloncorp/ui';
import * as Form from '@tloncorp/ui/src/components/Form';
import { useMemo } from 'react';
import { useForm } from 'react-hook-form';

import { FixtureWrapper } from './FixtureWrapper';

const FormFixture = () => {
  const { control, reset } = useForm({
    mode: 'onChange',
    defaultValues: {
      title: '',
      description: '',
      number: 'one',
      listItem: 'chat',
    },
  });

  const formRules = useMemo(() => {
    return { maxLength: { value: 5, message: 'Noooo too long' } };
  }, []);

  const options: Form.RadioInputOption<string>[] = [
    { title: 'One', value: 'one', description: 'This is one things' },
    { title: 'Two', value: 'two', description: 'This is two things' },
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

  return (
    <ScrollView flex={1}>
      <Form.FormFrame>
        <Form.ControlledTextField
          name={'title'}
          label="Title"
          control={control}
          rules={formRules}
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
        <Form.RadioControl disabled={true} />
        <Form.RadioControl checked={false} />
        <Form.RadioControl checked={true} />
        <Form.ListItemInput options={listOptions} />
        <Form.Field required error="Bad thing happen" label="My label">
          <Form.TextInput placeholder="Type here" />
        </Form.Field>
        <Button
          onPress={() =>
            reset({
              title: 'monk',
              description: '',
            })
          }
        >
          <Button.Text>Reseet</Button.Text>
        </Button>
      </Form.FormFrame>
    </ScrollView>
  );
};

export default (
  <FixtureWrapper fillWidth fillHeight>
    <FormFixture />
  </FixtureWrapper>
);

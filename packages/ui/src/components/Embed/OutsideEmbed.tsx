import { useState } from 'react';
import { Text } from 'tamagui';

import { Icon } from '../Icon';
import { Embed } from './Embed';

export default function OutsideEmbed({ url }: { url: string }) {
  const [showModal, setShowModal] = useState(false);

  return (
    <Embed height={100}>
      <Embed.Header onPress={() => ({})}>
        <Embed.Title>Video</Embed.Title>
        <Embed.PopOutIcon />
      </Embed.Header>
      <Embed.Preview onPress={() => setShowModal(true)}>
        <Icon type="Play" />
        <Text>Watch</Text>
      </Embed.Preview>
      <Embed.Modal
        visible={showModal}
        onDismiss={() => setShowModal(false)}
      ></Embed.Modal>
    </Embed>
  );
}

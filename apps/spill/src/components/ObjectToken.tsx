import * as db from '@db';
import {Image, XStack} from '@ochre';
import React from 'react';
import {SizableText, styled, withStaticProperties} from 'tamagui';
import {Avatar} from './ochre/Avatar';

const ObjectTokenFrame = styled(XStack, {
  alignSelf: 'flex-start',
  borderRadius: '$s',
  backgroundColor: '$secondaryBackground',
  paddingHorizontal: '$s',
  gap: '$s',
  alignItems: 'center',
  paddingVertical: '$xs',
});

const ObjectTokenImage = styled(Image, {
  width: 16,
  height: 16,
  borderRadius: 2,
});

const ObjectTokenText = styled(SizableText, {
  numberOfLines: 1,
  size: '$s',
});

export const ObjectToken = withStaticProperties(ObjectTokenFrame, {
  Image: ObjectTokenImage,
  Text: ObjectTokenText,
});

export function ChannelToken({model}: {model: db.Channel}) {
  const image = model.image ?? model.group?.iconImage;
  return (
    <ObjectToken>
      {image && <ObjectToken.Image source={{uri: image}} />}
      <ObjectToken.Text>{model.title}</ObjectToken.Text>
    </ObjectToken>
  );
}

export function GroupToken({model}: {model: db.Group}) {
  const image = model.iconImage;
  return (
    <ObjectToken>
      {image && <ObjectToken.Image source={{uri: image}} />}
      <ObjectToken.Text>{model.title}</ObjectToken.Text>
    </ObjectToken>
  );
}

export function UserToken({model}: {model: db.User}) {
  return (
    <ObjectToken>
      <Avatar id={model.id} size={'$m'} />
      <ObjectToken.Text>{model.id}</ObjectToken.Text>
    </ObjectToken>
  );
}

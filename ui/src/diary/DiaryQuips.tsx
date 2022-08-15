import { useRouteGroup } from '@/state/groups';
import React from 'react';
import { useParams } from 'react-router';

export default function DiaryQuips(props: {}) {
  const { chShip, chName, noteId } = useParams();
  const chFlag = `${chShip}/${chName}`;
  const nest = `chat/${chFlag}`;
  const flag = useRouteGroup();

  return <p>STILL TODO: quips for {noteId}</p>;
}

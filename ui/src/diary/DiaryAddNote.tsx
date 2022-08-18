import ChannelHeader from '@/channels/ChannelHeader';
import CoverImageInput from '@/components/CoverImageInput';
import Layout from '@/components/Layout/Layout';
import { useRouteGroup } from '@/state/groups';
import React from 'react';
import { useParams } from 'react-router';
import DiaryEditor, { useDiaryEditor } from './DiaryEditor';

export default function DiaryAddNote() {
  const { chShip, chName } = useParams();
  const chFlag = `${chShip}/${chName}`;
  const nest = `diary/${chFlag}`;
  const flag = useRouteGroup();

  const editor = useDiaryEditor({
    content: '',
    placeholder: 'Start writing here, or click the menu to add a link block',
  });

  return (
    <Layout
      className="align-center w-full flex-1 bg-white"
      header={<ChannelHeader flag={flag} nest={nest} />}
    >
      <div className="mx-auto max-w-xl space-y-12 p-4">
        <CoverImageInput url="https://0x0.st/oT-r.jpg" />
        <form className="contents">
          <input
            placeholder="New Title"
            className="input-transparent text-3xl"
            type="text"
          />
          {editor ? <DiaryEditor editor={editor} /> : null}
        </form>
      </div>
    </Layout>
  );
}

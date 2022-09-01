import CoverImageInput from '@/components/CoverImageInput';
import CaretLeftIcon from '@/components/icons/CaretLeftIcon';
import Layout from '@/components/Layout/Layout';
import { useRouteGroup } from '@/state/groups';
import { Verse } from '@/types/diary';
import React, { useState } from 'react';
import { useParams } from 'react-router';
import { Link } from 'react-router-dom';
import DiaryInlineEditor, { useDiaryInlineEditor } from './DiaryInlineEditor';

const TEST_CONTENT: Verse[] = [
  {
    inline: ['foo bar'],
  },
  {
    inline: ['baz more tests'],
  },
];

export default function DiaryAddNote() {
  const { chShip, chName } = useParams();
  const chFlag = `${chShip}/${chName}`;
  const nest = `diary/${chFlag}`;
  const flag = useRouteGroup();
  const [content, setContent] = useState(TEST_CONTENT);

  const editor = useDiaryInlineEditor({
    content: '',
    placeholder: '',
    onEnter: () => false,
  });

  return (
    <Layout
      className="align-center w-full flex-1 bg-white"
      mainClass="overflow-y-auto"
      header={
        <header className="flex h-full items-center justify-between border-b-2 border-gray-50 bg-white p-4">
          <Link
            to="../.."
            className="flex h-8 w-8 items-center justify-center rounded bg-gray-50"
            aria-label="Back to notebook"
          >
            <CaretLeftIcon className="h-6 w-6 text-gray-600" />
          </Link>
          <button className="button bg-blue text-white dark:text-black">
            Publish
          </button>
        </header>
      }
    >
      <div className="mx-auto max-w-xl p-4">
        <CoverImageInput url="https://0x0.st/oT-r.jpg" />
        <form className="space-y-6 py-6">
          <input
            placeholder="New Title"
            className="input-transparent text-3xl"
            type="text"
          />
          {editor ? <DiaryInlineEditor editor={editor} /> : null}
        </form>
      </div>
    </Layout>
  );
}

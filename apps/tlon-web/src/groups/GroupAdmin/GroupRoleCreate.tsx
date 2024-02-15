import LoadingSpinner from '@/components/LoadingSpinner/LoadingSpinner';
import Tooltip from '@/components/Tooltip';
import { strToSym } from '@/logic/utils';
import {
  useGroup,
  useGroupAddRoleMutation,
  useGroupCompatibility,
  useRouteGroup,
} from '@/state/groups';
import { useEffect, useState } from 'react';
import { useParams } from 'react-router';

type Props = {
  onCreate: () => void;
};

export default function GroupRoleCreate({ onCreate }: Props) {
  const { cabal } = useParams<{ cabal: string }>();
  const flag = useRouteGroup();
  const group = useGroup(flag);
  const { compatible, text } = useGroupCompatibility(flag);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const { mutateAsync, status } = useGroupAddRoleMutation();

  useEffect(() => {
    if (cabal && group?.cabals[cabal] && title === '' && description === '') {
      setTitle(group.cabals[cabal].meta.title);
      setDescription(group.cabals[cabal].meta.description);
    }
  }, [cabal, group, title, description]);

  const createRole = async () => {
    try {
      await mutateAsync({
        flag,
        sect: strToSym(title).replace(/[^a-z]*([a-z][-\w\d]+)/i, '$1'),
        meta: {
          title,
          description,
        },
      });
      onCreate();
    } catch (err) {
      console.error('Error creating group role:', err);
    }
  };

  return (
    <div className="mt-6 flex flex-col space-y-4">
      <div className="flex flex-col space-y-2">
        <label htmlFor="title" className="font-medium">
          Name
        </label>
        <input
          className="input"
          name="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          disabled={!!cabal}
        />
      </div>
      <div className="flex flex-col space-y-2">
        <label htmlFor="description" className="font-medium">
          Description
        </label>
        <textarea
          className="input"
          name="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>
      <div className="flex flex-row justify-end space-x-2">
        <Tooltip content={text} open={compatible ? false : undefined}>
          <button
            className="button bg-blue text-white"
            onClick={() => createRole()}
            disabled={
              !compatible ||
              status === 'loading' ||
              !title ||
              status === 'success'
            }
          >
            {status === 'loading' ? (
              <div className="flex items-center gap-1">
                {cabal ? 'Updating...' : 'Creating...'}
                <LoadingSpinner className="h-4 w-4" />
              </div>
            ) : cabal ? (
              'Submit'
            ) : status === 'success' ? (
              'Created'
            ) : (
              'Create'
            )}
          </button>
        </Tooltip>
      </div>
    </div>
  );
}

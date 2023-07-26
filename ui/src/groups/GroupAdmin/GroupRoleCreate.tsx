import { useEffect, useState } from 'react';
import { useParams } from 'react-router';
import LoadingSpinner from '@/components/LoadingSpinner/LoadingSpinner';
import {
  useRouteGroup,
  useGroupAddRoleMutation,
  useGroup,
} from '@/state/groups';
import { strToSym } from '@/logic/utils';

export default function GroupRoleCreate() {
  const { cabal } = useParams<{ cabal: string }>();
  const flag = useRouteGroup();
  const group = useGroup(flag);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const { mutate, status } = useGroupAddRoleMutation();

  useEffect(() => {
    if (cabal && group && title === '' && description === '') {
      setTitle(group.cabals[cabal].meta.title);
      setDescription(group.cabals[cabal].meta.description);
    }
  }, [cabal, group, title, description]);

  const createRole = () => {
    mutate({
      flag,
      sect: strToSym(title).replace(/[^a-z]*([a-z][-\w\d]+)/i, '$1'),
      meta: {
        title,
        description,
      },
    });
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
        <button
          className="button bg-blue text-white"
          onClick={() => createRole()}
          disabled={status === 'loading' || !title || status === 'success'}
        >
          {status === 'loading' ? (
            <div className="flex flex-row space-x-2">
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
      </div>
    </div>
  );
}

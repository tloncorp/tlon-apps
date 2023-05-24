import Dialog from '@/components/Dialog';
import LoadingSpinner from '@/components/LoadingSpinner/LoadingSpinner';
import { useDismissNavigate } from '@/logic/routing';
import {
  useRouteGroup,
  useGroupAddRoleMutation,
  useGroup,
} from '@/state/groups';
import { useEffect, useState } from 'react';
import { useParams } from 'react-router';

export default function GroupRoleDialog() {
  const dismiss = useDismissNavigate();
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
      sect: title.toLowerCase().replace(/ /g, '-'),
      meta: {
        title,
        description,
      },
    });
    dismiss();
  };

  return (
    <Dialog
      open
      onOpenChange={(open) => !open && dismiss()}
      containerClass="w-full max-w-lg"
      close="none"
    >
      <div className="flex flex-col space-y-4">
        <h2 className="text-lg font-bold">Create Role</h2>
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
            disabled={status === 'loading'}
            className="secondary-button"
            onClick={() => dismiss()}
          >
            Cancel
          </button>
          <button
            className="button bg-blue text-white"
            onClick={() => createRole()}
            disabled={status === 'loading'}
          >
            {status === 'loading' ? (
              <div className="flex flex-row space-x-2">
                {cabal ? 'Updating...' : 'Creating...'}
                <LoadingSpinner className="h-4 w-4" />
              </div>
            ) : cabal ? (
              'Submit'
            ) : (
              'Create'
            )}
          </button>
        </div>
      </div>
    </Dialog>
  );
}

import fuzzy from 'fuzzy';
import _, { debounce } from 'lodash';
import {
  ChangeEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Helmet } from 'react-helmet';
import { Link, useLocation } from 'react-router-dom';

import IconButton from '@/components/IconButton';
import LoadingSpinner from '@/components/LoadingSpinner/LoadingSpinner';
import MobileHeader from '@/components/MobileHeader';
import Tooltip from '@/components/Tooltip';
import CaretLeftIcon from '@/components/icons/CaretLeftIcon';
import CaretRightIcon from '@/components/icons/CaretRightIcon';
import GlobeIcon from '@/components/icons/GlobeIcon';
import KeyIcon from '@/components/icons/KeyIcon';
import StarIcon from '@/components/icons/StarIcon';
import { useIsMobile } from '@/logic/useMedia';
import { getPrivacyFromGroup } from '@/logic/utils';
import { useChannels } from '@/state/channel/channel';
import {
  useAmAdmin,
  useGroup,
  useGroupCompatibility,
  useGroupDelRoleMutation,
  useGroupEditRoleMutation,
  useRouteGroup,
} from '@/state/groups';

import RoleCreate from './GroupRoleCreate';

function eqRoleName(a: string, b: string) {
  return a.toLocaleLowerCase() === b.toLocaleLowerCase();
}

export default function GroupRoles({ title }: { title: string }) {
  const [roleTitle, setRoleTitle] = useState('');
  const [editingRoleTitle, setEditingRoleTitle] = useState(false);
  const [description, setDescription] = useState('');
  const [editingDescription, setEditingDescription] = useState(false);
  const [deleteField, setDeleteField] = useState('');
  const { mutate, status } = useGroupEditRoleMutation();
  const flag = useRouteGroup();
  const group = useGroup(flag);
  const amAdmin = useAmAdmin(flag);
  const { compatible, text } = useGroupCompatibility(flag);
  const [rawInput, setRawInput] = useState('');
  const [search, setSearch] = useState('');
  const [editRole, setEditRole] = useState('');
  const [createRole, setCreateRole] = useState(false);
  const { mutateAsync: deleteRoleMutation, status: deleteStatus } =
    useGroupDelRoleMutation();
  const roles = group?.cabals;
  const fleet = group?.fleet;
  const channels = useChannels();
  const { state } = useLocation();
  const isMobile = useIsMobile();

  // TODO: is this needed?
  const currentlyUsedRoles = group
    ? _.uniq([
        ...Object.entries(group.channels)
          .map((c) => c[1].readers)
          .flat(),
        ...Object.entries(group.fleet)
          .map((v) => v[1].sects)
          .flat(),
        ...Object.entries(group.channels)
          .map((c) => {
            const channel = channels[c[0]];

            return channel?.perms.writers || [];
          })
          .flat(),
      ])
    : [];
  const roleNames = Object.keys(roles || {});
  const privacy = group ? getPrivacyFromGroup(group) : 'public';

  const results = useMemo(
    () =>
      fuzzy
        .filter(search, roleNames)
        .sort((a, b) => {
          const filter = search || '';
          const left = a.string?.startsWith(filter) ? a.score + 1 : a.score;
          const right = b.string?.startsWith(filter) ? b.score + 1 : b.score;

          return right - left;
        })
        .map((result) => roleNames[result.index]),
    [search, roleNames]
  );

  const onUpdate = useRef(
    debounce((value: string) => {
      setSearch(value);
    }, 150)
  );

  const onChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const { value } = event.target;
    setRawInput(value);
    onUpdate.current(value);
  }, []);

  const handleDeleteRole = async (role: string) => {
    try {
      await deleteRoleMutation({ flag, sect: role });
      setEditRole('');
    } catch (err) {
      console.error('Error deleting group role:', err);
    }
  };

  const onRoleTitleChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      setEditingRoleTitle(true);
      const { value } = event.target;
      setRoleTitle(value);
    },
    [setRoleTitle]
  );

  const onDescriptionChange = useCallback(
    (event: ChangeEvent<HTMLTextAreaElement>) => {
      setEditingDescription(true);
      const { value } = event.target;
      setDescription(value);
    },
    [setDescription]
  );

  const onDeleteChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const { value } = event.target;
      setDeleteField(value);
    },
    [setDeleteField]
  );

  const updateRole = () => {
    mutate({
      flag,
      sect: editRole,
      meta: {
        title: roleTitle,
        description,
      },
    });
  };

  const backToRoles = () => {
    setEditRole('');
    setEditingRoleTitle(false);
    setCreateRole(false);
  };

  useEffect(() => {
    if (!editingRoleTitle && !editingDescription) {
      if (editRole) {
        setRoleTitle(group?.cabals[editRole]?.meta.title || '');
        setDescription(group?.cabals[editRole]?.meta.description || '');
      } else {
        setRoleTitle('');
        setDescription('');
        setDeleteField('');
      }
    }
  }, [editRole, group, editingRoleTitle, editingDescription]);

  return (
    <>
      <Helmet>
        <title>
          {group?.meta ? `Roles for ${group.meta.title} ${title}` : title}
        </title>
      </Helmet>
      {isMobile && (
        <MobileHeader title="Roles" pathBack={`/groups/${flag}/edit`} />
      )}
      {editRole === '' && !createRole && (
        <div className=" my-4 flex flex-col space-y-4 px-6 md:px-4">
          <h2 className="text-lg font-semibold">Group Roles</h2>
          <p className="leading-5 text-gray-600">
            Create roles for sub-groups of members. Assign roles to group
            members in the Members section. Assign read and write permissions
            for roles in the Edit dialog of each channel.
          </p>
          <div>
            {(privacy === 'public' || amAdmin) && (
              <button
                onClick={() => setCreateRole(true)}
                className="button bg-blue px-2 dark:text-black sm:px-4"
              >
                Create Role
              </button>
            )}
          </div>
        </div>
      )}
      <div className="card relative">
        {editRole !== '' && !createRole && (
          <div className="flex w-full flex-col space-y-4">
            <div className="flex items-center space-x-3">
              <IconButton
                label='Back to "Roles"'
                action={backToRoles}
                className="rounded bg-gray-50"
                icon={<CaretLeftIcon className="h-5 w-5 text-gray-400" />}
              />
              <h2 className="text-lg font-bold">
                Editing Role: {group?.cabals[editRole]?.meta.title}
              </h2>
            </div>
            <div className="flex flex-col space-y-2">
              <label htmlFor="title" className="font-medium">
                Name
              </label>
              <input
                name="title"
                className="input"
                value={roleTitle}
                onChange={onRoleTitleChange}
              />
            </div>
            <div className="flex flex-col space-y-2">
              <label htmlFor="description" className="font-medium">
                Description
              </label>
              <textarea
                name="description"
                className="input"
                value={description}
                onChange={onDescriptionChange}
              />
            </div>
            <div className="flex flex-row justify-end space-x-2">
              <Tooltip content={text} open={compatible ? false : undefined}>
                <button
                  className="button bg-blue text-white"
                  onClick={() => updateRole()}
                  disabled={status === 'loading' || !compatible}
                >
                  {status === 'loading' ? (
                    <div className="flex items-center gap-1">
                      Saving...
                      <LoadingSpinner className="h-4 w-4" />
                    </div>
                  ) : (
                    'Save Role'
                  )}
                </button>
              </Tooltip>
            </div>
          </div>
        )}
        {!editRole && !createRole && (
          <>
            <label className="relative mb-4 flex items-center">
              <span className="sr-only">Search Roles</span>
              <input
                className="input h-10 w-full border-0 bg-gray-50 text-sm mix-blend-multiply placeholder:font-normal dark:mix-blend-normal md:text-base"
                placeholder={`Search (${roleNames.length + 1}) roles`}
                value={rawInput}
                onChange={onChange}
              />
            </label>
            <div className="flex w-full flex-col space-y-4" key="roles">
              {!search && (
                <div className="flex w-full items-center justify-between rounded-lg bg-white p-2">
                  <div className="flex flex-row items-center space-x-4">
                    <GlobeIcon className="h-8 w-8 rounded-sm bg-gray-50 p-1 text-gray-400" />
                    <div className="flex flex-col space-y-1">
                      <p className="font-semibold">Members (Default)</p>
                      {fleet && (
                        <p className="text-sm font-semibold text-gray-400">
                          {Object.entries(fleet).length} Members
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}
              {results.map(
                (roleName) =>
                  roles &&
                  roles[roleName].meta && (
                    <div
                      onClick={() => setEditRole(roleName)}
                      className="flex w-full cursor-pointer items-center justify-between rounded-lg bg-white p-2 hover:bg-gray-50"
                      key={roleName}
                      aria-label={`Edit ${roleName}`}
                    >
                      <div className="flex flex-row items-center space-x-4">
                        {roleName === 'admin' ? (
                          <StarIcon className="h-8 w-8 rounded-sm bg-yellow-soft p-1 text-yellow" />
                        ) : (
                          <KeyIcon className="h-8 w-8 rounded-sm bg-blue-soft p-1 text-blue" />
                        )}
                        <div className="flex flex-col space-y-1">
                          <p className="font-semibold">
                            {roleName === 'admin'
                              ? 'Admin'
                              : roles[roleName].meta.title}
                          </p>
                          {fleet && (
                            <p className="text-sm font-semibold text-gray-400">
                              {
                                Object.entries(fleet).filter(([s, v]) =>
                                  v.sects.includes(roleName)
                                ).length
                              }{' '}
                              Members
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center justify-end space-x-4">
                        <CaretRightIcon className="h-6 w-6 text-gray-400" />
                      </div>
                    </div>
                  )
              )}
            </div>
          </>
        )}
        {editRole === '' && createRole && (
          <>
            <div className="flex items-center space-x-3">
              <IconButton
                label='Back to "Roles"'
                action={backToRoles}
                className="rounded bg-gray-50"
                icon={<CaretLeftIcon className="h-5 w-5 text-gray-400" />}
              />
              <h2 className="text-lg font-bold">Create Role</h2>
            </div>
            <RoleCreate onCreate={backToRoles} />
          </>
        )}
      </div>

      {editRole && (
        <div className="card mt-4 flex flex-col space-y-4">
          <h1 className="text-lg font-bold">
            Delete Role and Revoke Permissions
          </h1>
          <p className="leading-5">
            Type the name of the role to confirm deletion. This action is
            irreversible.
          </p>
          <input
            className="input"
            placeholder="Role Name"
            value={deleteField}
            onChange={onDeleteChange}
          />
          <div className="mt-8 flex justify-end space-x-2">
            <button
              className="secondary-button"
              onClick={() => setDeleteField('')}
              disabled={deleteStatus === 'loading' || !deleteField}
            >
              Cancel
            </button>
            <Tooltip content={text} open={compatible ? false : undefined}>
              <button
                className="button flex items-center gap-1 bg-red"
                disabled={
                  !compatible ||
                  deleteStatus === 'loading' ||
                  !eqRoleName(
                    deleteField,
                    group?.cabals[editRole]?.meta.title || ''
                  )
                }
                onClick={() => handleDeleteRole(editRole)}
              >
                {deleteStatus === 'loading' ? (
                  <>
                    Deleting...
                    <LoadingSpinner h-4 w-4 mr-2 />
                  </>
                ) : (
                  'Delete'
                )}
              </button>
            </Tooltip>
          </div>
        </div>
      )}
    </>
  );
}

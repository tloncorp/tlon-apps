import _, { debounce } from 'lodash';
import { motion, AnimatePresence } from 'framer-motion';
import fuzzy from 'fuzzy';
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
import { getPrivacyFromGroup, nestToFlag } from '@/logic/utils';
import {
  useAmAdmin,
  useGroup,
  useGroupDelRoleMutation,
  useGroupEditRoleMutation,
  useRouteGroup,
} from '@/state/groups';
import { useChatState } from '@/state/chat';
import { useDiaryState } from '@/state/diary';
import { useHeapState } from '@/state/heap/heap';
import CaretRightIcon from '@/components/icons/CaretRightIcon';
import LoadingSpinner from '@/components/LoadingSpinner/LoadingSpinner';
import GlobeIcon from '@/components/icons/GlobeIcon';
import StarIcon from '@/components/icons/StarIcon';
import KeyIcon from '@/components/icons/KeyIcon';
import CaretLeftIcon from '@/components/icons/CaretLeftIcon';
import IconButton from '@/components/IconButton';

function eqRoleName(a: string, b: string) {
  return a.toLocaleLowerCase() === b.toLocaleLowerCase();
}

const animationConfig = {
  type: 'spring',
  stiffness: 1500,
  damping: 120,
};

export default function GroupRoles({ title }: { title: string }) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [roleTitle, setRoleTitle] = useState('');
  const [editingRoleTitle, setEditingRoleTitle] = useState(false);
  const [description, setDescription] = useState('');
  const [editingDescription, setEditingDescription] = useState(false);
  const [deleteField, setDeleteField] = useState('');
  const { mutate, status } = useGroupEditRoleMutation();
  const flag = useRouteGroup();
  const group = useGroup(flag);
  const amAdmin = useAmAdmin(flag);
  const location = useLocation();
  const [rawInput, setRawInput] = useState('');
  const [search, setSearch] = useState('');
  const [editRole, setEditRole] = useState('');
  const { mutate: deleteRoleMutation, status: deleteStatus } =
    useGroupDelRoleMutation();
  const roles = group?.cabals;
  const fleet = group?.fleet;

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
            const [app, channelFlag] = nestToFlag(c[0]);

            const chState =
              app === 'chat'
                ? useChatState.getState().chats
                : app === 'heap'
                ? useHeapState.getState().stash
                : useDiaryState.getState().shelf;

            const channel = chState[channelFlag];

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

  const handleDeleteRole = (role: string) => {
    deleteRoleMutation({ flag, sect: role });
    setEditRole('');
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
      sect: editRole.toLowerCase().replace(/ /g, '-'),
      meta: {
        title: roleTitle,
        description,
      },
    });
  };

  const backToRoles = () => {
    setEditRole('');
    setEditingRoleTitle(false);
  };

  const calculateTotalHeight = useCallback(() => {
    if (editRole) return 250;
    const roleCount = results.length + (search ? 0 : 1); // Including the default "Everyone" role
    const roleHeight = 48;
    const extraHeight = 16 * (roleCount - 1); // Based on the 'space-y-4' class
    return roleCount * roleHeight + extraHeight;
  }, [results, search, editRole]);

  useEffect(() => {
    if (wrapperRef.current) {
      const newHeight = calculateTotalHeight();
      wrapperRef.current.style.height = `${newHeight}px`;
    }
  }, [results, search, calculateTotalHeight]);

  useEffect(() => {
    if (!editingRoleTitle && !editingDescription) {
      if (editRole) {
        setRoleTitle(group?.cabals[editRole].meta.title || '');
        setDescription(group?.cabals[editRole].meta.description || '');
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
      <div className="card mb-4 flex flex-col space-y-4">
        <div className="mb-8 flex flex-col">
          <h2 className="text-lg font-bold">Group Roles</h2>
          <p className="mt-1 text-gray-600">
            Assign permissions and capabilities to sub-groups of members
          </p>
          <div className="my-8 flex items-center space-x-4">
            {(privacy === 'public' || amAdmin) && (
              <Link
                to={`/groups/${flag}/role`}
                state={{ backgroundLocation: location }}
                className="button bg-blue px-2 dark:text-black sm:px-4"
              >
                Create Role
              </Link>
            )}
          </div>
          <label className="relative flex items-center">
            <span className="sr-only">Search Roles</span>
            <input
              className="input h-10 w-full border-0 bg-gray-50 text-sm mix-blend-multiply placeholder:font-normal dark:mix-blend-normal md:text-base"
              placeholder={`Search (${roleNames.length + 1}) roles`}
              value={rawInput}
              onChange={onChange}
            />
          </label>
        </div>
        <div
          className="height-transition relative overflow-hidden"
          ref={wrapperRef}
        >
          <AnimatePresence initial={false}>
            {editRole !== '' ? (
              <motion.div
                initial={{ x: 2000, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: 2000, opacity: 0 }}
                transition={animationConfig}
                key="edit-role"
                className="absolute flex w-full flex-col space-y-4"
              >
                <div className="flex items-center space-x-3">
                  <IconButton
                    label='Back to "Roles"'
                    action={backToRoles}
                    className="rounded bg-gray-50"
                    icon={<CaretLeftIcon className="h-5 w-5 text-gray-400" />}
                  />
                  <h2 className="text-lg font-bold">
                    Editing Role: {group?.cabals[editRole].meta.title}
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
                  <button
                    className="button bg-blue text-white"
                    onClick={() => updateRole()}
                    disabled={status === 'loading'}
                  >
                    {status === 'loading' ? (
                      <div className="flex flex-row space-x-2">
                        Saving...
                        <LoadingSpinner className="h-4 w-4" />
                      </div>
                    ) : (
                      'Save Role'
                    )}
                  </button>
                </div>
              </motion.div>
            ) : (
              <motion.div
                initial={{ x: -2000, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: -2000, opacity: 0 }}
                transition={animationConfig}
                className="absolute flex w-full flex-col space-y-4"
                key="roles"
              >
                {!search && (
                  <div className="flex h-12 cursor-pointer items-center justify-between rounded-lg p-2 hover:bg-gray-50">
                    <div className="flex flex-row items-center space-x-4">
                      <GlobeIcon className="h-8 w-8 rounded-sm bg-gray-50 p-1 text-gray-400" />
                      <div className="flex flex-col space-y-1">
                        <p className="font-semibold">Everyone (Default)</p>
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
                        className="flex h-12 cursor-pointer items-center justify-between rounded-lg p-2 hover:bg-gray-50"
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
                                ? 'Owners'
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
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
      <AnimatePresence>
        {editRole && (
          <motion.div
            initial={{ y: 2000, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 2000, opacity: 0 }}
            transition={animationConfig}
            className="card mb-4 flex flex-col space-y-4"
          >
            <h1 className="mb-4 text-lg font-bold">
              Delete Role and Revoke Permissions
            </h1>
            <p>
              Type the name of the role to confirm deletion. This role will be
              removed from all members currently assigned to it, and associated
              permissions with this role will be revoked. This action is
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
              <button
                className="button center-items flex bg-red"
                title={
                  currentlyUsedRoles.includes(editRole)
                    ? 'This role is currently in use and cannot be deleted'
                    : 'Delete role'
                }
                disabled={
                  currentlyUsedRoles.includes(editRole) ||
                  deleteStatus === 'loading' ||
                  !eqRoleName(
                    deleteField,
                    group?.cabals[editRole].meta.title || ''
                  )
                }
                onClick={() => handleDeleteRole(editRole)}
              >
                {deleteStatus === 'loading' ? (
                  <>
                    <LoadingSpinner h-4 w-4 mr-2 />
                    Deleting...
                  </>
                ) : (
                  'Delete'
                )}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

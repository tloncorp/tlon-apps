import { useState } from 'react';
import { Helmet } from 'react-helmet';
import { Link, useLocation } from 'react-router-dom';
import ConfirmationModal from '@/components/ConfirmationModal';
import { getPrivacyFromGroup } from '@/logic/utils';
import {
  useAmAdmin,
  useGroup,
  useGroupDelRoleMutation,
  useRouteGroup,
} from '@/state/groups';

export default function GroupRoles({ title }: { title: string }) {
  const flag = useRouteGroup();
  const group = useGroup(flag);
  const amAdmin = useAmAdmin(flag);
  const location = useLocation();
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [roleToDelete, setRoleToDelete] = useState('');
  const { mutate: deleteRoleMutation } = useGroupDelRoleMutation();
  if (!group) return null;
  const roles = group?.cabals;
  const roleNames = Object.keys(roles || {});
  const privacy = getPrivacyFromGroup(group);

  console.log({ roles });

  const handleDeleteRole = () => {
    deleteRoleMutation({ flag, sect: roleToDelete });
    setShowDeleteModal(false);
  };

  const handleShowDeleteModal = (roleName: string) => {
    setRoleToDelete(roleName);
    setShowDeleteModal(true);
  };

  return (
    <>
      <Helmet>
        <title>
          {group?.meta ? `Roles for ${group.meta.title} ${title}` : title}
        </title>
      </Helmet>
      <div className="card mb-4 flex flex-col space-y-4">
        <h2 className="text-lg font-bold">Group Roles</h2>
        <div className="flex items-center space-x-4">
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
        <div className="grid grid-cols-3 items-center gap-4">
          <p className="font-semibold">Role</p>
          <p className="font-semibold">Description</p>
          <div />
          {roleNames.map(
            (roleName) =>
              roles[roleName].meta && (
                <>
                  <p>{roles[roleName].meta.title}</p>
                  <p>{roles[roleName].meta.description}</p>
                  <div className="flex items-center justify-end space-x-4">
                    {roleName !== 'admin' && (
                      <>
                        <Link
                          to={`/groups/${flag}/role/${roleName}`}
                          state={{ backgroundLocation: location }}
                          className="small-secondary-button sm:px-4"
                        >
                          Edit
                        </Link>
                        <button
                          onClick={() => handleShowDeleteModal(roleName)}
                          className="small-button w-14 bg-red px-2 dark:text-black sm:px-4"
                        >
                          Delete
                        </button>
                      </>
                    )}
                  </div>
                </>
              )
          )}
          <p>Member</p>
          <p>Normal members of the group</p>
        </div>
      </div>
      <ConfirmationModal
        open={showDeleteModal}
        setOpen={setShowDeleteModal}
        title="Delete Role"
        message="Are you sure you want to delete this role?"
        confirmText="Delete"
        onConfirm={handleDeleteRole}
      />
    </>
  );
}

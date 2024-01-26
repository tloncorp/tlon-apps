import Dialog from '@/components/Dialog';
import { useContact } from '@/state/contact';
import ShipName from '@/components/ShipName';
import Avatar from '@/components/Avatar';
import RoleSelect from './RoleSelector';

export default function SetRolesDialog({
  roles,
  member,
  open,
  onOpenChange,
  className,
}: {
  roles: string[];
  member: string;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  className?: string;
}) {
  const contact = useContact(member);

  return (
    <Dialog open={open} onOpenChange={onOpenChange} className={className}>
      <h3 className="mt-1 font-bold">Edit Roles</h3>
      <div className="my-5 flex flex-col items-center justify-center">
        <Avatar ship={member} size="small" className="mb-2" />
        {contact?.nickname ? (
          <div className="flex">
            <span className="mr-2 font-medium">{contact.nickname}</span>
            <ShipName name={member} full className="text-gray-400" />
          </div>
        ) : (
          <span className="font-medium">
            <ShipName name={member} full />
          </span>
        )}
      </div>
      <div className="max-h-[300px] overflow-auto">
        {roles.map((role) => (
          <div className="my-2" key={role}>
            <RoleSelect role={role} member={member} />
          </div>
        ))}
      </div>
    </Dialog>
  );
}

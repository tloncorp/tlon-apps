import { useForm } from 'react-hook-form';

import { useNavigate } from 'react-router';
import WidgetDrawer from '@/components/WidgetDrawer';
import { useDismissNavigate } from '@/logic/routing';
import { useCreateGroupMutation } from '@/state/groups';
import { strToSym } from '@/logic/utils';

type GroupCreateSchema = {
  title: string;
};

const createGroupName = (title: string) =>
  strToSym(title).replace(/[^a-z]*([a-z][-\w\d]+)/i, '$1');

export default function GroupCreateDialog() {
  const navigate = useNavigate();
  const dismiss = useDismissNavigate();
  const { mutateAsync: createGroupMutation, status } = useCreateGroupMutation();
  const { register, watch, handleSubmit } = useForm<GroupCreateSchema>({
    defaultValues: {
      title: '',
    },
  });

  const groupTitle = watch('title');
  const groupSlug = `${window.our}/${
    createGroupName(groupTitle) || 'group-name'
  }`;

  const onSubmit = handleSubmit(async ({ title }) => {
    try {
      await createGroupMutation({
        title,
        name: createGroupName(title),
        description: '',
        image: '',
        cover: '',
        cordon: {
          shut: {
            pending: [],
            ask: [],
          },
        },
        members: {},
        secret: true,
      });
      navigate(`/groups/${groupSlug}`);
    } catch (err) {
      console.error('Error creating group:', err);
    }
  });

  return (
    <WidgetDrawer
      onOpenChange={(o) => !o && dismiss()}
      className="px-6 py-12"
      open
    >
      <h1 className="text-center text-[17px] font-medium">New Group</h1>
      <form onSubmit={onSubmit} className="mt-6 space-y-4 text-gray-400">
        <label htmlFor="title">Name your group, you can edit it later</label>
        <input
          {...register('title')}
          id="name"
          className="w-full rounded-lg border border-gray-200 bg-transparent p-4 text-[17px] font-medium"
          type="text"
          placeholder="Group name"
        />
        <p>
          Your <span className="text-gray-800">secret</span> group will live at:
          <br />
          {groupSlug}
        </p>
        <p>You can edit your group&apos;s privacy later.</p>
        <button
          className="w-full rounded-xl border border-blue/20 bg-blue-soft/90 px-6 py-5 text-left text-[17px] font-medium text-blue active:bg-blue-soft disabled:border-gray-400/50 disabled:bg-gray-50 disabled:text-gray-400"
          type="submit"
          disabled={!groupTitle || status === 'loading'}
        >
          Create Group
        </button>
      </form>
    </WidgetDrawer>
  );
}

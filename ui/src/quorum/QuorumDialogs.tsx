import React, { ReactNode, useState, useEffect, useCallback, useRef } from 'react';
import _ from 'lodash';
import { FormProvider, useForm, useController } from 'react-hook-form';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import {
  PlusIcon,
  EnterIcon,
  QuestionMarkIcon,
  Cross2Icon,
  HomeIcon,
  ExclamationTriangleIcon,
} from '@radix-ui/react-icons';
import api from '@/api';
import QuorumAuthor from '@/quorum/QuorumAuthor';
import Dialog from '@/components/Dialog';
import {
  SingleSelector,
  MultiSelector,
  SelectorOption,
} from '@/components/Selector';
import LoadingSpinner from '@/components/LoadingSpinner/LoadingSpinner';
import QuorumPrivacySelector from '@/quorum/QuorumPermsSelector';
import MarkdownBlock from '@/components/MarkdownBlock';
import {
  RefPlaceholder,
} from '@/quorum/QuorumPlaceholders';
import {
  useBoardFlag,
  useBoardMetas,
  useQuorumBriefs,
  useNewBoardMutation,
  useJoinBoardMutation,
  useDeleteBoardMutation,
  useLeaveBoardMutation,
  useDeletePostMutation,
} from '@/state/quorum';
import { useGroups, useChannelList } from '@/state/groups';
import {
  isChannelJoined,
  canReadChannel,
  getFlagParts,
  nestToFlag,
} from '@/logic/utils';
import {
  inlineToMarkdown,
  isChatRef,
  isGroupAdmin,
  getChannelIdFromTitle,
  makeTerseDateAndTime,
} from '@/logic/quorum-utils';
import { useDismissNavigate, useAnchorNavigate } from '@/logic/routing';
import { Groups, Group, GroupChannel, Channels } from '@/types/groups';
import { ChatWrit, ChatWrits, ChatStory } from '@/types/chat';
import { QuorumBrief, QuorumBriefs } from '@/types/quorum';


interface GroupsRef {
  id: string;
  flag: string;
  author: string;
  timestamp: number;
  content: string;
};


export function CreateDialog() {
  const dismiss = useDismissNavigate();
  const onOpenChange = (open: boolean) => (!open && dismiss());

  const groups: Groups = useGroups();
  const {status: groupsStatus} =
    useQueryClient().getQueryState<Groups>(["groups"]) ??
    {status: "error"};
  const {mutate: newMutation, status: newStatus} = useNewBoardMutation({
    onSuccess: () => dismiss(),
  });
  const boards = useBoardMetas();

  const adminGroups = (Object.entries(groups) as [string, Group][])
    .filter(([flag, group]: [string, Group]) => isGroupAdmin(group));
  const groupOpts = adminGroups.map(([flag, {meta}]: [string, Group]) => ({
    value: flag,
    label: meta.title,
  }));

  const form = useForm({
    mode: "onChange",
    defaultValues: {
      group: "",
      name: "",
      description: "",
      privacy: "public",
      readers: [],
      writers: [],
    },
  });
  const {register, handleSubmit, formState: {isDirty, isValid}, control} = form;
  const {field: {value: group, onChange: groupOnChange, ref: groupRef}} =
    useController({name: "group", rules: {required: true}, control});
  const onSubmit = useCallback(async ({
    group: groupFlag,
    name,
    description,
    privacy,
    readers,
    writers,
  }: {
    group: string;
    name: string;
    description: string;
    privacy: string;
    readers: string[];
    writers: string[];
  }) => {
    // FIXME: Like the 'landscape-apps' front-end, we only try a backup once,
    // which means there's a small chance for collisions if many channels with
    // the same name are created in a group.
    const [boardName, backupBoardName] = getChannelIdFromTitle(name);
    const hasBaseBoard: boolean = undefined !== (boards || []).find(({board: currFlag}) =>
      getFlagParts(currFlag)["name"] === boardName
    );
    newMutation({
      create: {
        group: groupFlag,
        name: hasBaseBoard ? backupBoardName : boardName,
        title: name,
        description: description,
        readers: readers,
        writers: writers,
      }
    });
  }, [newMutation, boards]);

  return (
    <DefaultDialog onOpenChange={onOpenChange}>
      <FormProvider {...form}>
        <div className="w-5/6">
          <header className="mb-3 flex items-center">
            <h2 className="text-lg font-bold">Create New Q&A Channel</h2>
          </header>
        </div>

        <form onSubmit={handleSubmit(onSubmit)}>
          <label className="mb-3 font-semibold">
            Group Name*
            <SingleSelector
              ref={groupRef}
              options={groupOpts}
              value={groupOpts.find(e => e.value === group)}
              onChange={o => groupOnChange(o ? o.value : o)}
              isLoading={groupsStatus === "loading"}
              noOptionsMessage={() =>
                `Please select an existing group for which you have admin privileges.`
              }
              className="my-2 w-full"
              autoFocus
            />
          </label>
          <label className="mb-3 font-semibold">
            Channel Name*
            <input type="text" autoComplete="off"
              className="input my-2 block w-full py-1 px-2"
              {...register("name", {required: true})}
            />
          </label>
          <label className="mb-3 font-semibold">
            Channel Description
            <input type="text" autoComplete="off"
              className="input my-2 block w-full py-1 px-2"
              {...register("description", {required: false})}
            />
          </label>
          {group !== "" && (
            <label className="mb-3 font-semibold">
              Channel Permissions
              <QuorumPrivacySelector group={groups[group]} />
            </label>
          )}

          <footer className="mt-4 flex items-center justify-between space-x-2">
            <div className="ml-auto flex items-center space-x-2">
              <DialogPrimitive.Close asChild>
                <button className="secondary-button ml-auto">
                  Cancel
                </button>
              </DialogPrimitive.Close>
              <button
                type="submit"
                className="button"
                disabled={!isValid || !isDirty}
              >
                {newStatus === 'loading' ? (
                  <LoadingSpinner />
                ) : newStatus === 'error' ? (
                  'Error'
                ) : (
                  'Create'
                )}
              </button>
            </div>
          </footer>
        </form>
      </FormProvider>
    </DefaultDialog>
  );
}

export function JoinDialog() {
  const dismiss = useDismissNavigate();
  const onOpenChange = (open: boolean) => (!open && dismiss());
  const {mutate: joinMutation, status: joinStatus} = useJoinBoardMutation({
    onSuccess: () => dismiss(),
  });

  const groups: Groups = useGroups();
  const {status: groupsStatus} =
    useQueryClient().getQueryState<Groups>(["groups"]) ??
    {status: "error"};
  const groupOpts = Object.entries(groups).filter(([flag, _]: [string, Group]) => (
    getFlagParts(flag)["ship"] !== window.our
  )).map(([flag, {meta}]: [string, Group]) => ({
    value: flag,
    label: meta.title,
  }));
  const briefs: QuorumBriefs = useQuorumBriefs();
  const realBriefs: QuorumBriefs = _.mapKeys(briefs, (v, k) => `quorum/${k}`);

  const form = useForm({
    mode: 'onChange',
    defaultValues: {
      group: '',
      channel: '',
    },
  });
  const {register, handleSubmit, resetField, formState: {isDirty, isValid}, control} = form;
  const {field: {value: group, onChange: groupOnChange, ref: groupRef}} =
    useController({name: "group", rules: {required: true}, control});
  const {field: {value: channel, onChange: channelOnChange, ref: channelRef}} =
    useController({name: "channel", rules: {required: true}, control});
  const onSubmit = useCallback(({
    group: groupFlag,
    channel,
  }: {
    group: string;
    channel: string;
  }) => {
    joinMutation({
      flag: channel,
      join: {
        group: groupFlag,
        chan: nestToFlag(channel)[1],
      },
    });
  }, [joinMutation]);

  const channels: Channels = ((groups?.[group]?.channels || {}) as unknown as Channels);
  const channelOpts = Object.entries(channels).filter(
    ([nest, chan]: [string, GroupChannel]) =>
      !isChannelJoined(nest, realBriefs)
      && canReadChannel(chan, groups[group].fleet?.[window.our], groups[group].bloc)
      && nestToFlag(nest)[0] === "quorum"
  ).map(([flag, {meta}]: [string, GroupChannel]) => ({
    value: flag,
    label: meta.title,
  }));

  return (
    <DefaultDialog onOpenChange={onOpenChange}>
      <FormProvider {...form}>
        <div className="w-5/6">
          <header className="mb-3 flex items-center">
            <h2 className="text-lg font-bold">Join Existing Q&A Channel</h2>
          </header>
        </div>

        <form onSubmit={handleSubmit(onSubmit)}>
          <label className="mb-3 font-semibold">
            Group Name*
            <SingleSelector
              ref={groupRef}
              options={groupOpts}
              value={groupOpts.find(e => e.value === group)}
              onChange={o => {
                groupOnChange(o ? o.value : o);
                resetField("channel");
              }}
              isLoading={groupsStatus === "loading"}
              noOptionsMessage={() =>
                `Please select an existing non-local group that you've joined.`
              }
              className="my-2 w-full"
              autoFocus
            />
          </label>
          <label className="mb-3 font-semibold">
            Channel Name*
            <SingleSelector
              ref={channelRef}
              options={channelOpts}
              value={channelOpts.find(e => e.value === channel)}
              onChange={o => channelOnChange(o ? o.value : o)}
              isLoading={groupsStatus === "loading"}
              isDisabled={!Boolean(group)}
              noOptionsMessage={() =>
                (channelOpts.length === 0)
                ? `No accessible unjoined %quorum channels found.`
                : `Please select an existing unjoined %quorum channel.`
              }
              className="my-2 w-full"
            />
          </label>

          <footer className="mt-4 flex items-center justify-between space-x-2">
            <div className="ml-auto flex items-center space-x-2">
              <DialogPrimitive.Close asChild>
                <button className="secondary-button ml-auto">
                  Cancel
                </button>
              </DialogPrimitive.Close>
              <button className="button" type="submit"
                disabled={!isValid || !isDirty}>
                {joinStatus === 'loading' ? (
                  <LoadingSpinner />
                ) : joinStatus === 'error' ? (
                  'Error'
                ) : (
                  'Join'
                )}
              </button>
            </div>
          </footer>
        </form>
      </FormProvider>
    </DefaultDialog>
  );
}

export function RefDialog() {
  // TODO: Show a warning message if the given ref is non-empty and invalid
  // TODO: Show a check mark or green message if the given ref is non-empty
  // and valid
  // TODO: Add support for importing a window of references surrounding the
  // one input by the user (e.g. import a series of temporally proximal
  // references from groups)
  // TODO: Selecting import messages in the form causes them to be added to
  // the form's 'messages' field; deselecting them causes them to be removed
  const [loadedRefs, setLoadedRefs] = useState<GroupsRef[]>([]);

  const dismiss = useDismissNavigate();
  const onOpenChange = (open: boolean) => (!open && dismiss());

  const form = useForm({
    mode: 'onChange',
    defaultValues: {
      importRef: '',
      messages: [],
    },
  });
  const {register, handleSubmit, formState: {isDirty, isValid}, control, watch} = form;
  const importRef = watch("importRef", "");
  const {field: {value: messages, onChange: messagesOnChange, ref: messagesRef}} =
    useController({name: "messages", rules: {required: true}, control});
  const onSubmit = useCallback(({
    importRef,
    messages
  }: {
    importRef: string;
    messages: GroupsRef[];
  }) => {
    dismiss(messages.map(({id, flag, author, timestamp, content}) =>
      `${content}\n> Imported from \`${flag}\`; original author \`${
      author}\` at ${makeTerseDateAndTime(new Date(timestamp))}`
    )[0]);
  }, [dismiss]);

  useEffect(() => {
    if (isChatRef(importRef)) {
      const [refChShip, refChName, _, refAuthor, refId]: string[] =
        importRef.split("/").slice(-5);
      // TODO: Add an error handling case here for when the user inputs a
      // structurally valid ref that isn't in `%groups` (scry returns null/error).
      api.scry<ChatWrits>({
        app: "chat",
        path: `/chat/${refChShip}/${refChName}/writs/newer/${refId}/1`,
      }).then((result: ChatWrits) => {
        const newLoadedRefs = (Object.entries(result) as [string, ChatWrit][])
          .map(([refId, {memo: refMemo}]): GroupsRef => ({
            id: refId,
            flag: `${refChShip}/${refChName}`,
            author: refMemo.author,
            timestamp: refMemo.sent,
            content: (refMemo.content as {story: ChatStory})
              .story.inline.map(inlineToMarkdown).join(""),
          }));
        setLoadedRefs(newLoadedRefs);
        messagesOnChange(newLoadedRefs);
      });
    } else if (!isChatRef(importRef) && loadedRefs.length > 0) {
      setLoadedRefs([]);
      messagesOnChange([]);
    }
  }, [importRef]);

  return (
    <DefaultDialog onOpenChange={onOpenChange}>
      <FormProvider {...form}>
        <div className="w-5/6">
          <header className="mb-3 flex items-center">
            <h2 className="text-lg font-bold">Import Groups Content</h2>
          </header>
        </div>

        <form onSubmit={handleSubmit(onSubmit)}>
          <label className="mb-3 font-semibold">
            Groups Reference*
            <input type="text" autoComplete="off"
              className="input my-2 block w-full py-1 px-2"
              {...register("importRef", {required: true, validate: isChatRef})}
            />
          </label>

          <label className="mb-3 font-semibold">
            Reference Selection*
          </label>
          <div className="max-h-[200px] overflow-scroll">
            {loadedRefs.length === 0 ? (
              isChatRef(importRef) ? (
                <RefPlaceholder count={1} />
              ) : (
                <p>Input a valid groups reference to see selection.</p>
              )
            ) : (
              <div className="flex flex-col w-full items-center">
                {/* <span onClick={() => {}}>Load Older</span> */}
                {/* TODO: "border-4 border-gray-800" for selected entries */}
                {loadedRefs.map(({id, flag, author, timestamp, content}) => (
                  <div key={id} className="w-full card  bg-gray-100 dark:bg-gray-200">
                    <div
                      className="flex items-center space-x-2 font-semibold mb-3"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <QuorumAuthor ship={author} date={new Date(timestamp)} />
                    </div>
                    <MarkdownBlock content={content} archetype="body" />
                  </div>
                ))}
                {/* <span onClick={() => {}}>Load Newer</span> */}
              </div>
            )}
          </div>

          <footer className="mt-4 flex items-center justify-between space-x-2">
            <div className="ml-auto flex items-center space-x-2">
              <DialogPrimitive.Close asChild>
                <button className="secondary-button ml-auto">
                  Cancel
                </button>
              </DialogPrimitive.Close>
              <button
                type="submit"
                className="button"
                disabled={!isValid || !isDirty}
              >
                Import
              </button>
            </div>
          </footer>
        </form>
      </FormProvider>
    </DefaultDialog>
  );
}

export function PreviewDialog() {
  const dismiss = useDismissNavigate();
  const location = useLocation();
  const state = location?.state;
  const content = useRef(state?.foregroundPayload);
  const onOpenChange = (open: boolean) => (!open && dismiss(content.current));

  return (
    <DefaultDialog onOpenChange={onOpenChange}>
      <div className="w-5/6">
        <header className="mb-3 flex items-center">
          <h2 className="text-lg font-bold">Preview Post</h2>
        </header>
      </div>

      <div className="w-full card bg-gray-100 dark:bg-gray-200">
        <div
          className="flex items-center space-x-2 font-semibold mb-3"
          onClick={(e) => e.stopPropagation()}
        >
          <QuorumAuthor ship={window.our} date={new Date(Date.now())} />
        </div>
        <MarkdownBlock content={content.current} archetype="body" />
      </div>

      <footer className="mt-4 flex items-center justify-between space-x-2">
        <div className="ml-auto flex items-center space-x-2">
          <DialogPrimitive.Close asChild>
            <button className="secondary-button ml-auto">
              Dismiss
            </button>
          </DialogPrimitive.Close>
        </div>
      </footer>
    </DefaultDialog>
  );
}

export function DeleteDialog() {
  // TODO: Revise the content of the dialog based on whether the
  // deleting user is the author or the admin (author overrides admin
  // message in the case that both are true).
  const anchorNavigate = useAnchorNavigate();
  const dismiss = useDismissNavigate();
  const onOpenChange = (open: boolean) => (!open && dismiss());
  const params = useParams();

  const boardFlag = useBoardFlag();
  const isThread = params.response === params.thread;
  const {mutate: deleteMutation, status: deleteStatus} = useDeletePostMutation({
    onSuccess: () => !isThread ? dismiss() : anchorNavigate(),
  });

  const onSubmit = useCallback(async (event) => {
    event.preventDefault();
    deleteMutation({
      flag: boardFlag,
      update: {
        "post-id": Number(params.response)
      }
    });
  }, [params, deleteMutation]);

  return (
    <DefaultDialog onOpenChange={onOpenChange}>
      <div className="w-5/6">
        <header className="mb-3 flex items-center">
          <h2 className="text-lg font-bold">
            Delete {isThread ? "Thread" : "Response"}
          </h2>
        </header>
      </div>

      <form onSubmit={onSubmit}>
        <p>
          Do you really want to delete
          {isThread
            ? " this entire thread, including all responses"
            : " your response to this question"
          }?
        </p>

        <footer className="mt-4 flex items-center justify-between space-x-2">
          <div className="ml-auto flex items-center space-x-2">
            <DialogPrimitive.Close asChild>
              <button className="secondary-button ml-auto">
                Cancel
              </button>
            </DialogPrimitive.Close>
            <button className="button bg-red" type="submit">
              {deleteStatus === 'loading' ? (
                <LoadingSpinner />
              ) : deleteStatus === 'error' ? (
                'Error'
              ) : (
                'Delete'
              )}
            </button>
          </div>
        </footer>
      </form>
    </DefaultDialog>
  );
}

export function DestroyDialog() {
  // TODO: Try to combine this with 'DeleteDialog'
  const dismiss = useDismissNavigate();
  const onOpenChange = (open: boolean) => (!open && dismiss());

  const boardFlag = useBoardFlag();
  const isBoardOwner = getFlagParts(boardFlag).ship === window.our;
  const {mutate: destroyMutation, status: destroyStatus} = isBoardOwner
    ? useDeleteBoardMutation({onSuccess: () => dismiss()})
    : useLeaveBoardMutation({onSuccess: () => dismiss()});

  const onSubmit = useCallback(async (event) => {
    event.preventDefault();
    destroyMutation({flag: boardFlag});
  }, [boardFlag, destroyMutation]);

  return (
    <DefaultDialog onOpenChange={onOpenChange}>
      <div className="w-5/6">
        <header className="mb-3 flex items-center">
          <h2 className="text-lg font-bold">
            {isBoardOwner ? "Delete" : "Leave"} Board
          </h2>
        </header>
      </div>

      <form onSubmit={onSubmit}>
        <p>
          Do you really want to
          {isBoardOwner
            ? ` delete board '${boardFlag}', including all content`
            : ` leave board '${boardFlag}'`
          }?
        </p>

        <footer className="mt-4 flex items-center justify-between space-x-2">
          <div className="ml-auto flex items-center space-x-2">
            <DialogPrimitive.Close asChild>
              <button className="secondary-button ml-auto">
                Cancel
              </button>
            </DialogPrimitive.Close>
            <button className="button bg-red" type="submit">
              {destroyStatus === 'loading' ? (
                <LoadingSpinner />
              ) : destroyStatus === 'error' ? (
                'Error'
              ) : (
                isBoardOwner ? "Delete" : "Leave"
              )}
            </button>
          </div>
        </footer>
      </form>
    </DefaultDialog>
  );
}

// export function AboutDialog() {
//   const dismiss = useDismissNavigate();
//   const onOpenChange = (open: boolean) => (!open && dismiss());
//
//   return (
//     <DefaultDialog onOpenChange={onOpenChange}>
//       <p>TODO: Create About Page</p>
//     </DefaultDialog>
//   );
// }

// FIXME: Gross duplication of '@/components/Dialog' content, but needed in
// order to minimize edits to 'landscape-apps' files.
type DialogCloseLocation = 'default' | 'none' | 'lightbox' | 'app' | 'header';
interface DialogContentProps extends DialogPrimitive.DialogContentProps {
  containerClass?: string;
  close?: DialogCloseLocation;
}
type DialogProps = DialogPrimitive.DialogProps &
  DialogContentProps & {
    trigger?: ReactNode;
  };

function DefaultDialog(props: DialogProps) {
  return (
    <Dialog defaultOpen modal containerClass="w-full sm:max-w-lg" {...props} />
  );
}

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams, useLocation, Link } from 'react-router-dom';
import { FormProvider, useForm, useController, useWatch } from 'react-hook-form';
import {
  PlusIcon,
  EnterIcon,
  QuestionMarkIcon,
  DownloadIcon,
  Cross2Icon,
  HomeIcon,
  EyeOpenIcon,
  ExclamationTriangleIcon,
} from '@radix-ui/react-icons';
import Editor from 'react-simple-code-editor';
import { highlight, languages } from 'prismjs';
import 'prismjs/components/prism-markup';
import 'prismjs/components/prism-markdown';
import Dialog from '@/components/Dialog';
import {
  SingleSelector,
  MultiSelector,
  CreatableSingleSelector,
  CreatableMultiSelector,
  SelectorOption,
} from '@/components/Selector';
import LoadingSpinner from '@/components/LoadingSpinner/LoadingSpinner';
import ErrorRedirect from '@/components/ErrorRedirect';
import { PostThreadPlaceholder } from '@/quorum/QuorumPlaceholders';
import { GenericLink } from '@/components/Links';
import { TagModeRadio } from '@/components/Radio';
import { QuorumPostStrand } from '@/quorum/QuorumPost';
import { useGroupFlag, useVessel, useGroup, useGroups, useChannel } from '@/state/groups';
import {
  useBoardMeta,
  useThread,
  useBoardFlag,
  useEditBoardMutation,
  useNewThreadMutation,
  useEditThreadMutation,
  useNewReplyMutation,
  useEditPostMutation,
} from '@/state/quorum';
import { getOriginalEdit, getLatestEdit } from '@/logic/quorum-utils';
import { useModalNavigate, useAnchorNavigate } from '@/logic/routing';
import { canWriteChannel } from '@/logic/utils';
import { BoardMeta, BoardThread, BoardPost, QuorumEditBoard } from '@/types/quorum';
import { ClassProps } from '@/types/quorum-ui';


// FIXME: There's a weird issue with all forms wherein using the syntax
// `const {... formState, ...} = form;` causes forms to lag by 1 input on
// recognizing a valid form, where using the syntax
// `const {... {isDirty, isValid} ...} = form;` works fine. The latter syntax
// is used everywhere for forms to avoid this problem, though ideally the
// `form` assignment could take any shape and the form would "just work".


interface BoardFormTags {
  options: SelectorOption[];
  restricted: boolean;
};

interface ResponseErrorProps {
  header: string;
  content: string;
  to: string;
};


export function ResponseForm({className}: ClassProps) {
  const [errorData, setErrorData] = useState<ResponseErrorProps | undefined>(undefined);

  const anchorNavigate = useAnchorNavigate();
  const modalNavigate = useModalNavigate();
  const location = useLocation();
  const state = location?.state;
  const params = useParams();

  const isQuestionNew = params?.thread === undefined;
  const isQuestionSub = isQuestionNew || params?.thread === params?.response;
  const subTitlePrefix = isQuestionNew ? "Question" : "New";

  const boardFlag = useBoardFlag();
  const board = useBoardMeta(boardFlag);
  const {options: tagOptions, restricted: areTagsRestricted} = getFormTags(board);
  const thread: BoardThread | undefined = isQuestionNew
    ? undefined
    : useThread(boardFlag, Number(params?.thread || 0));

  const groupFlag = useGroupFlag();
  const group = useGroup(groupFlag, true);
  const channel = useChannel(groupFlag, `quorum/${boardFlag}`);
  const vessel = group?.fleet?.[window.our] || {sects: [], joined: 0};
  const canWrite = canWriteChannel({writers: board?.writers || []}, vessel, group?.bloc);
  // const canRead = channel ? canReadChannel(channel, vessel, group?.bloc) : false;

  const form = useForm({
    mode: 'onChange',
    defaultValues: {
      title: "",
      tags: ([] as string[]),
      content: "",
    },
  });
  const {register, handleSubmit, reset, formState: {isDirty, isValid, dirtyFields}, control} = form;
  const {field: {value: title, onChange: titleOnChange, ref: titleRef}} =
    useController({name: "title", rules: {required: isQuestionSub}, control});
  const {field: {value: content, onChange: contentOnChange, ref: contentRef}} =
    useController({name: "content", rules: {required: true}, control});
  const {field: {value: tags, onChange: tagsOnChange, ref: tagsRef}} =
    useController({name: "tags", rules: {required: false}, control});

  const {mutate: newThreadMutation, status: newThreadStatus} = useNewThreadMutation({
    onSuccess: () => anchorNavigate(`thread/${board?.["next-id"]}`),
  });
  const {mutate: newReplyMutation, status: newReplyStatus} = useNewReplyMutation({
    onSuccess: () => anchorNavigate(`thread/${params.thread}`),
  });
  const {mutate: editThreadMutation, status: editThreadStatus} = useEditThreadMutation({
    onSuccess: () => anchorNavigate(`thread/${params.thread}`),
  });
  const {mutate: editPostMutation, status: editPostStatus} = useEditPostMutation({
    onSuccess: () => anchorNavigate(`thread/${params.thread}`),
  });
  const mutateStatuses = [newThreadStatus, newReplyStatus, editThreadStatus, editPostStatus];
  const isLoading = Boolean(mutateStatuses.find(s => s === "loading"));
  const isErrored = Boolean(mutateStatuses.find(s => s === "error"));

  const onSubmit = useCallback(async ({
    title,
    tags,
    content,
  }: {
    title: string;
    tags: string[];
    content: string;
  }) => {
    if (isQuestionNew) {
      newThreadMutation({
        flag: boardFlag,
        update: {title, content, tags}
      });
    } else if (params?.response === undefined) {
      newReplyMutation({
        flag: boardFlag,
        update: {
          "parent-id": Number(params.thread),
          "content": content,
          "is-comment": false,
        },
      });
    } else {
      if (dirtyFields?.content) {
        editPostMutation({
          flag: boardFlag,
          update: {
            "post-id": Number(params?.response || 0),
            "content": content,
          },
        });
      }
      if (dirtyFields?.title || dirtyFields?.tags) {
        editThreadMutation({
          flag: boardFlag,
          update: {
            "post-id": Number(params?.response || 0),
            "title": dirtyFields?.title && title,
            "tags": dirtyFields?.tags && tags,
          },
        });
      }
    }
  }, [boardFlag, params, dirtyFields]);

  useEffect(() => {
    // NOTE: This isn't perfect because (1) it makes the rendering for
    // failure cases weird (flicker of real UI, then block page) and (2)
    // it's one way, meaning the UI will be in a permanent failure state
    // once an error occurs.
    if (errorData === undefined) {
      if (!canWrite) {
        setErrorData({
          header: "Permission Denied!",
          content: `You have read-only access to this board.
          Click the logo above to return to the main board page.`,
          to: `.`,
        });
      } else if (params?.response !== undefined && thread !== undefined) {
        const response = ([thread.thread].concat(thread.posts)).find(post =>
          Number(post["post-id"]) === Number(params.response));
        if (response === undefined) {
          setErrorData({
            header: `Response #${params.response} Missing!`,
            content: `Unable to locate the requested response in this thread.
            Click the logo above to return to the thread view.`,
            to: `./thread/${params.thread}`,
          });
        } else {
          const canEdit: boolean = getOriginalEdit(response).author === window.our
            || params.chShip === window.our;
          if (!canEdit) {
            setErrorData({
              header: `Permission Denied!`,
              content: `You are not allowed to edit this response.
              Click the logo above to return to the source thread.`,
              to: `./thread/${params.thread}`,
            });
          } else {
            reset({
              title: response.thread?.title || "",
              tags: ((response.thread?.tags.sort() || []) as string[]),
              content: getLatestEdit(response).content,
            });
          }
        }
      }
    }
  }, [params?.response, params?.thread, params?.chShip, thread, canWrite]);

  useEffect(() => {
    if (state?.foregroundPayload) {
      window.history.replaceState({}, document.title);
      contentOnChange(state.foregroundPayload);
    }
  }, [state?.foregroundPayload]);

  return (
    <div className={className}>
      {(board === undefined || (!isQuestionNew && thread === undefined)) ? (
        <PostThreadPlaceholder count={isQuestionNew ? 1 : 2} />
      ) : (errorData !== undefined) ? (
        <ErrorRedirect anchor {...errorData} />
      ) : (
        <React.Fragment>
          {(!isQuestionNew && thread !== undefined) ? (
            <QuorumPostStrand post={thread?.thread} />
          ) : (
            <div>
              <header className="mb-3 flex items-center">
                <h1 className="text-lg font-bold">
                  Submit a New Question to '{board.title}'
                </h1>
              </header>
            </div>
          )}
          <FormProvider {...form}>
            <div className="py-6">
              <form onSubmit={handleSubmit(onSubmit)}>
                {isQuestionSub && (
                  <React.Fragment>
                    <label className="mb-3 font-semibold">
                      {`${subTitlePrefix} Title*`}
                      <input type="text" autoComplete="off" autoFocus
                        ref={titleRef}
                        className="input my-2 block w-full py-1 px-2"
                        value={title}
                        disabled={!canWrite}
                        onChange={titleOnChange}
                      />
                    </label>
                    <label className="mb-3 font-semibold">
                      {`${subTitlePrefix} Tags`}
                      {areTagsRestricted ? (
                        <MultiSelector
                          ref={tagsRef}
                          options={tagOptions}
                          value={tags.sort().map(t => tagOptions.find(e => e.value === t) || {value: t, label: `#${t}`})}
                          onChange={o => tagsOnChange(o ? o.map(oo => oo.value).sort() : o)}
                          isLoading={board === undefined}
                          isDisabled={!canWrite}
                          noOptionsMessage={() =>
                            `Tags are restricted; please select an existing tag.`
                          }
                          className="my-2 w-full"
                        />
                      ) : (
                        <CreatableMultiSelector
                          ref={tagsRef}
                          options={tagOptions}
                          value={tags.sort().map(t => tagOptions.find(e => e.value === t) || {value: t, label: `#${t}`})}
                          onChange={o => tagsOnChange(o ? o.map(oo => oo.value).sort() : o)}
                          isLoading={board === undefined}
                          isDisabled={!canWrite}
                          noOptionsMessage={({inputValue}) => (
                            inputValue === "" || inputValue.match(/^[a-z][a-z0-9\-]*$/)
                              ? `Please enter question tags.`
                              : `Given tag is invalid; please enter a term.`
                          )}
                          isValidNewOption={(inputValue, value, options, accessors) =>
                            Boolean(inputValue.match(/^[a-z][a-z0-9\-]*$/))
                          }
                          className="my-2 w-full"
                        />
                      )}
                    </label>
                  </React.Fragment>
                )}
                <label className="mb-3 font-semibold">
                  <div className="flex flex-row justify-between items-center">
                    {isQuestionSub ? `${subTitlePrefix} Content*` : "Response*"}
                    <div className="flex flex-row gap-2">
                      <GenericLink to="pre"
                        disabled={!canWrite}
                        state={{backgroundLocation: location, foregroundPayload: content}}
                        className="small-button"
                      >
                        <EyeOpenIcon />
                      </GenericLink>
                      <GenericLink to="ref"
                        disabled={!canWrite}
                        state={{backgroundLocation: location}}
                        className="small-button"
                      >
                        <DownloadIcon />
                      </GenericLink>
                    </div>
                  </div>
                  <Editor
                    value={content}
                    onValueChange={contentOnChange}
                    highlight={code => highlight(code, languages.md, "md")}
                    // @ts-ignore
                    rows={8} // FIXME: workaround via 'min-h-...'
                    padding={8} // FIXME: workaround, but would prefer 'py-1 px-2'
                    ignoreTabKey={true}
                    disabled={!canWrite}
                    className="input my-2 block w-full min-h-[calc(8em+8px)]"
                  />
                </label>

                <footer className="mt-4 flex items-center justify-between space-x-2">
                  <div className="ml-auto flex items-center space-x-2">
                    <Link to="../"className="secondary-button ml-auto">
                      Cancel
                    </Link>
                    <button
                      type="submit"
                      className="button"
                      disabled={!canWrite || !isValid || !isDirty}
                    >
                      {isLoading ? (
                        <LoadingSpinner />
                      ) : isErrored ? (
                        "Error"
                      ) : (
                        "Submit"
                      )}
                    </button>
                  </div>
                </footer>
              </form>
            </div>
          </FormProvider>
        </React.Fragment>
      )}
    </div>
  );
}

export function SettingsForm({className}: ClassProps) {
  // TODO: Use 'BulkEditor' and for finer-grained editing control
  const boardFlag = useBoardFlag();
  const board = useBoardMeta(boardFlag);
  const {options: tagOptions, restricted: areTagsRestricted} = getFormTags(board);

  // TODO: The user should also be able to modify the settings if they're
  // an admin for the current board.
  const params = useParams();
  const canEdit = params.chShip === window.our;

  const form = useForm({
    mode: "onChange",
    defaultValues: {
      title: "",
      description: "",
      tagMode: "unrestricted",
      newTags: ([] as string[]),
    },
  });
  const {register, handleSubmit, reset, formState: {isDirty, isValid}, control} = form;
  const tagMode = useWatch({name: "tagMode", control});
  const {field: {value: newTags, onChange: newTagsOnChange, ref: newTagsRef}} =
    useController({name: "newTags", rules: {required: tagMode === "restricted"}, control});

  const {mutate: editMutation, status: editStatus} = useEditBoardMutation({
    onSuccess: () => reset({...form.getValues()}),
  });
  const onSubmit = useCallback(async ({
    title,
    description,
    tagMode,
    newTags,
  }: {
    title: string;
    description: string;
    tagMode: string;
    newTags: string[];
  }) => {
    const editUpdate: QuorumEditBoard = {
      title,
      description,
      tags: tagMode === "unrestricted" ? [] : newTags,
    };
    editMutation({flag: boardFlag, update: editUpdate});
  }, [boardFlag, editMutation]);

  // FIXME: It would be better if these could be integrated into the original
  // 'useForm' call like they are in
  //   'landscape-apps/ui/src/groups/GroupAdmin/GroupInfoEditor.tsx'
  // but this causes problems when reloading the settings page (all the values
  // show up as blank and are not updated for by 'board' changing some reason).
  useEffect(() => {
    reset({
      title: board?.title || "",
      description: board?.description || "",
      tagMode: areTagsRestricted ? "restricted" : "unrestricted",
      newTags: (board?.["allowed-tags"] || []).sort(),
    });
  }, [board, areTagsRestricted]);

  return (board === undefined) ? null : (
    <FormProvider {...form}>
      <div className={className}>
        <div>
          <header className="mb-3 flex items-center">
            <h1 className="text-lg font-bold">Change Settings for '{board.title}'</h1>
          </header>
        </div>

        <form onSubmit={handleSubmit(onSubmit)}>
          <label className="mb-3 font-semibold">
            Board Title
            <input type="text" autoComplete="off" autoFocus
              disabled={!canEdit}
              className="input my-2 block w-full py-1 px-2"
              {...register("title", {required: true})}
            />
          </label>
          <label className="mb-3 font-semibold">
            Board Description
            <input type="text" autoComplete="off"
              disabled={!canEdit}
              className="input my-2 block w-full py-1 px-2"
              {...register("description", {required: false})}
            />
          </label>

          <label className="mb-3 font-semibold">
            Tag Behavior
            <TagModeRadio field="tagMode" disabled={!canEdit} />
          </label>
          {(tagMode === "restricted") && (
            <CreatableMultiSelector
              ref={newTagsRef}
              options={tagOptions}
              value={newTags ? newTags.sort().map(t => tagOptions.find(e => e.value === t) || {value: t, label: `#${t}`}) : newTags}
              onChange={o => newTagsOnChange(o ? o.map(oo => oo.value).sort() : o)}
              isLoading={board === undefined}
              noOptionsMessage={({inputValue}) => (
                inputValue === "" || inputValue.match(/^[a-z][a-z0-9\-]*$/)
                  ? `Please enter one or more valid tags.`
                  : `Given tag is invalid; please enter a term.`
              )}
              isValidNewOption={(inputValue, value, options, accessors) =>
                Boolean(inputValue.match(/^[a-z][a-z0-9\-]*$/))
              }
              className="my-2 w-full font-semibold"
              isDisabled={!canEdit}
            />
          )}

          <footer className="mt-4 flex items-center justify-between space-x-2">
            <div className="ml-auto flex items-center space-x-2">
              <Link to="../" className="secondary-button ml-auto">
                Cancel
              </Link>
              <button
                type="submit"
                className="button"
                disabled={!canEdit || !isDirty || !isValid}
              >
                {editStatus === 'loading' ? (
                  <LoadingSpinner />
                ) : editStatus === 'error' ? (
                  'Error'
                ) : (
                  'Save'
                )}
              </button>
            </div>
          </footer>
        </form>
      </div>
    </FormProvider>
  );
}

function getFormTags(board: BoardMeta | undefined): BoardFormTags {
  return {
    restricted: !board || board["allowed-tags"].length > 0,
    options: !board
      ? []
      : board["allowed-tags"].sort().map(t => ({value: t, label: `#${t}`})),
  };
}

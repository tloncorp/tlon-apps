declare module 'markdown-it-task-lists' {
  import MarkdownIt from 'markdown-it';

  interface TaskListsPluginOptions {
    enabled?: boolean;
    label?: boolean;
    labelAfter?: boolean;
  }

  function taskLists(
    md: MarkdownIt,
    options?: TaskListsPluginOptions
  ): void;

  export = taskLists;
}

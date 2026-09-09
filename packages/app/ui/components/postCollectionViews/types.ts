export interface PostCollectionHandle {
  scrollToPost?: (postId: string, viewPosition?: number) => void;
  scrollToStart?: (opts: { animated?: boolean }) => void;
  scrollToLatest?: (opts: { animated?: boolean }) => void;
  highlightPost?: (postId: string) => void;
}

export type IPostCollectionView = React.ForwardRefExoticComponent<
  React.RefAttributes<PostCollectionHandle>
>;

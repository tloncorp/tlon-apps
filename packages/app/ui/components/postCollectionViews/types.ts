export interface PostCollectionHandle {
  scrollToPostAtIndex?: (index: number, viewPosition?: number) => void;
  scrollToStart?: (opts: { animated?: boolean }) => void;
  highlightPost?: (postId: string) => void;
}

export type IPostCollectionView = React.ForwardRefExoticComponent<
  React.RefAttributes<PostCollectionHandle>
>;

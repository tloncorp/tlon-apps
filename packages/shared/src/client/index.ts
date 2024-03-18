export namespace ClientTypes {
  export type Contact = {
    id: string;
    nickname: string | null;
    bio: string | null;
    status: string | null;
    color: string | null;
    avatarImage: string | null;
    coverImage: string | null;
    pinnedGroupIds: string[];
  };

  export type UnreadType = "channel" | "dm";
  export type Unread = {
    channelId: string;
    type: UnreadType;
    totalCount: number;
  };
}

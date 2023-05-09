export interface Contact {
  nickname: string;
  bio: string;
  status: string;
  color: string;
  avatar: string | null;
  cover: string | null;
  groups: string[];
}

export type ContactRolodex = Record<string, Contact | null>;

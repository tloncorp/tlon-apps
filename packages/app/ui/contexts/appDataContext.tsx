import * as db from '@tloncorp/shared/db';
import * as domain from '@tloncorp/shared/domain';
import { Session } from '@tloncorp/shared/store';
import { PropsWithChildren, createContext, useContext, useMemo } from 'react';

export type CalmState = {
  disableAvatars: boolean;
  disableRemoteContent: boolean;
  disableNicknames: boolean;
};

export type CurrentAppDataState = {
  currentUserId: string;
  contacts: db.Contact[] | null;
  contactIndex: Record<string, db.Contact> | null;
  branchDomain: string;
  branchKey: string;
  inviteServiceEndpoint: string;
  inviteServiceIsDev: boolean;
  session: Session | null;
  calmSettings: CalmState;
  webAppNeedsUpdate?: boolean;
  triggerWebAppUpdate?: (returnToRoot?: boolean) => Promise<void>;
  inviteSystemContacts?: (
    params: domain.SystemContactInviteParams
  ) => Promise<boolean>;
};

type ContextValue = CurrentAppDataState;

const Context = createContext<ContextValue | undefined>(undefined);

export const AppDataContextProvider = ({
  children,
  currentUserId,
  contacts,
  branchDomain,
  branchKey,
  inviteServiceEndpoint,
  inviteServiceIsDev,
  calmSettings,
  session,
  webAppNeedsUpdate,
  triggerWebAppUpdate,
  inviteSystemContacts,
}: PropsWithChildren<Partial<CurrentAppDataState>>) => {
  const value = useMemo(
    () => ({
      currentUserId: currentUserId ?? '',
      contacts: contacts ?? [],
      contactIndex: buildContactIndex(contacts ?? []),
      branchDomain: branchDomain ?? '',
      branchKey: branchKey ?? '',
      inviteServiceEndpoint: inviteServiceEndpoint ?? '',
      inviteServiceIsDev: inviteServiceIsDev ?? false,
      calmSettings: calmSettings ?? {
        disableRemoteContent: false,
        disableAvatars: false,
        disableNicknames: false,
      },
      session: session ?? null,
      webAppNeedsUpdate,
      triggerWebAppUpdate,
      inviteSystemContacts,
    }),
    [
      currentUserId,
      contacts,
      branchDomain,
      branchKey,
      inviteServiceEndpoint,
      inviteServiceIsDev,
      calmSettings,
      session,
      webAppNeedsUpdate,
      triggerWebAppUpdate,
      inviteSystemContacts,
    ]
  );
  return <Context.Provider value={value}>{children}</Context.Provider>;
};

export const useCurrentUserId = () => {
  const context = useAppDataContext();
  return context.currentUserId;
};

export const useContacts = () => {
  const context = useAppDataContext();
  return context.contacts;
};

export const useContactIndex = () => {
  const context = useAppDataContext();
  return context.contactIndex;
};

export const useContact = (ship: string) => {
  const contactIndex = useContactIndex();
  return contactIndex?.[ship] ?? null;
};

export const useInviteService = () => {
  const context = useAppDataContext();
  return {
    endpoint: context.inviteServiceEndpoint,
    isDev: context.inviteServiceIsDev,
  };
};

export const useBranchDomain = () => {
  const context = useAppDataContext();
  return context.branchDomain;
};

export const useBranchKey = () => {
  const context = useAppDataContext();
  return context.branchKey;
};

export const useCalm = () => {
  const context = useAppDataContext();
  return context.calmSettings;
};

export const useWebAppUpdate = () => {
  const context = useAppDataContext();

  return {
    webAppNeedsUpdate: context.webAppNeedsUpdate,
    triggerWebAppUpdate: context.triggerWebAppUpdate,
  };
};

export const useInviteSystemContacts = () => {
  const context = useAppDataContext();

  return context.inviteSystemContacts;
};

const useAppDataContext = (): CurrentAppDataState => {
  const context = useContext(Context);

  if (!context) {
    throw new Error(
      'Must call `useCurrentUser` within an `CurrentUserProvider` component.'
    );
  }

  return context;
};

function buildContactIndex(contacts: db.Contact[]) {
  return contacts.reduce(
    (acc, contact) => {
      acc[contact.id] = contact;
      return acc;
    },
    {} as Record<string, db.Contact>
  );
}

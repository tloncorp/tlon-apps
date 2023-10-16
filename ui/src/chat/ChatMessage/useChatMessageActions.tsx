import { useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { ChatWrit } from '@/types/chat';
import {
  canWriteChannel,
  useCopy,
  whomIsDm,
  whomIsMultiDm,
} from '@/logic/utils';
import { useChatPerms, useChatState, useMessageToggler } from '@/state/chat';
import { useAmAdmin, useChannel, useGroup, useVessel } from '@/state/groups';

export interface ChatMessage {
  context: {
    groupFlag: string;
    channelFlag: string;

    isDm: boolean;
    isMuliDM: boolean;
    isChatChannelMessage: boolean;
    inThread: boolean;

    canCopy: boolean;
    canDelete: boolean;
    canStartThread: boolean;
    canHide: boolean;
    canReply: boolean;
    canReact: boolean;
  };
  state: {
    didCopy: boolean;
    isDeleting: boolean;
    didDelete: boolean;
    isHidden: boolean;
  };
  actions: {
    copy: () => void;
    del: () => Promise<void>;
    goToThread: () => void;
    show: () => void;
    hide: () => void;
    reply: () => void;
    react: (shortcode: string) => Promise<void>;
  };
}

export default function useChatMessage(writ: ChatWrit): ChatMessage {
  const navigate = useNavigate();
  const params = useParams<{
    ship: string;
    name: string;
    chShip: string;
    chName: string;
    idShip?: string;
    idTime?: string;
  }>();

  const isChatChannelMessage = !!(params.chShip && params.chName);
  const isDm = !isChatChannelMessage && whomIsDm(params.ship || '');
  const isMuliDM = !isChatChannelMessage && whomIsMultiDm(params.ship || '');

  const basePath = isChatChannelMessage
    ? `/groups/${params.ship}/${params.name}/channels/chat/${params.chShip}/${params.chName}`
    : `/dm/${params.ship}`;

  const groupFlag = `${params.ship}/${params.name}`;
  const group = useGroup(groupFlag);
  const vessel = useVessel(groupFlag, window.our);

  const channelFlag = `${params.chShip}/${params.chName}`;
  const nest = `chat/${channelFlag}`;
  const channel = useChannel(groupFlag, nest);

  const perms = useChatPerms(channelFlag);
  const isAdmin = useAmAdmin(groupFlag);
  const canWrite = canWriteChannel(perms, vessel, group?.bloc);

  const canCopy = !isDm && !isMuliDM;
  const { didCopy, doCopy: copy } = useCopy(
    `/1/chan/chat/${channelFlag}/msg/${writ.seal.id}`
  );

  // react
  const canReact = canWrite;
  const react = async (shortcode: string) => {
    const whom = params.chShip
      ? `${params.chShip}/${params.chName}`
      : params.ship;
    await useChatState.getState().addFeel(whom!, writ.seal.id, shortcode);
  };

  // thread
  const inThread = !!(params.idShip && params.idTime);
  const canStartThread = canWrite && !inThread;
  const goToThread = () => {
    if (inThread) return;
    navigate(`${basePath}/message/${writ.seal.id}`);
  };

  // reply
  const canReply = canWrite && !inThread;
  const reply = () => {
    if (!canReply) return;
    navigate({
      pathname: basePath,
      search: `?chat_reply=${writ.seal.id}`,
    });
  };

  // hide
  const canHide = window.our !== writ.memo.author;
  const { show, hide, isHidden } = useMessageToggler(writ.seal.id);

  // delete
  const canDelete = isAdmin || window.our === writ.memo.author;
  const [isDeleting, setIsDeleting] = useState(false);
  const [didDelete, setDidDelete] = useState(false);
  const del = async () => {
    if (!canDelete) return;
    setIsDeleting(true);
    try {
      await useChatState.getState().delMessage(channelFlag, writ.seal.id);
      setDidDelete(true);
    } catch (e) {
      console.error('Failed to delete message:', e);
    } finally {
      setIsDeleting(false);
    }
  };

  return {
    context: {
      groupFlag,
      channelFlag,

      isDm,
      isMuliDM,
      isChatChannelMessage,
      inThread,

      canCopy,
      canDelete,
      canStartThread,
      canHide,
      canReply,
      canReact,
    },
    state: {
      didCopy,
      isDeleting,
      didDelete,
      isHidden,
    },
    actions: {
      copy,
      del,
      goToThread,
      show,
      hide,
      reply,
      react,
    },
  };
}

const useIsChat = () => {
  const IS_CHAT =
    import.meta.env.MODE === 'chat' ||
    import.meta.env.MODE === 'chatmock' ||
    import.meta.env.MODE === 'chatstaging';

  return IS_CHAT;
};

export default useIsChat;

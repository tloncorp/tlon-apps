const useIsChannelHost = (flag: string) => window.our === flag?.split('/')[0];

export default useIsChannelHost;

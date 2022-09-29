export default function useAppName() {
  switch (import.meta.env.VITE_APP) {
    case 'chat':
      return 'Talk';
    case 'groups':
      return 'Groups';
    default:
      return 'Unknown';
  }
}

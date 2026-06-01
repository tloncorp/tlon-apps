export function useCurrentUserId() {
  return window.our;
}

export function useCurrentUserIdOrNull(): string | null {
  return typeof window !== 'undefined' && window.our ? window.our : null;
}

export function getDefaultBotName(userNickname?: string | null) {
  const trimmedNickname = userNickname?.trim();
  if (!trimmedNickname) {
    return 'Tlonbot';
  }

  return `${trimmedNickname}'s Tlonbot 🌱`;
}

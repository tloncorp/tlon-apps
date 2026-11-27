export function getDefaultBotName(userNickname?: string | null) {
  const trimmedNickname = userNickname?.trim();
  if (!trimmedNickname) {
    return 'Sato';
  }

  return `${trimmedNickname}'s Sato 🌱`;
}

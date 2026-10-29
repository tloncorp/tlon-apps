/**
 * Where background setup stands: the home group, the bot and the DM landing.
 * `late` means setup ran past its deadline: it keeps going in the background,
 * and the chat opens without waiting for it.
 */
export type FirstRunSetupStatus = 'running' | 'ready' | 'late';

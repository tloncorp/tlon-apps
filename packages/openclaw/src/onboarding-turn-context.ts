// Trusted notes appended to an owner's message while first-run onboarding is
// active. Kept apart from the monitor so the onboarding lab replays the same
// wording the gateway sends.

export function onboardingDmContextNote(target: string): string {
  return (
    `\n[First-run onboarding DM context: use target ${target} ` +
    'for typed onboarding tools. ' +
    'Before responding, read and follow ~/.openclaw/plugin-skills/tlon-agent-onboarding/SKILL.md. ' +
    'This DM is already bound to that onboarding group; continue setup here and do not redirect the owner to create or open another group.]'
  );
}

export function onboardingClientDateTimeNote(input: {
  timezone: string;
  locale: string;
}): string {
  return (
    `\n[Client date/time context: device timezone ${input.timezone}; ` +
    `locale ${input.locale}. Interpret unqualified schedule times in this ` +
    'device timezone. Always format visible onboarding times with AM/PM, even when the locale normally uses 24-hour time. Keep cron expressions and ' +
    'technical timezone identifiers out of user-facing choices and confirmations. ' +
    'If the owner explicitly names another timezone, preserve that override and ' +
    'describe it in ordinary language.]'
  );
}

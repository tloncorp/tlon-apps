/**
 * The starter templates offered by onboarding's first interstitial.
 *
 * Each id is the kit that will eventually be installed for that choice. None of
 * those kits exist yet — only `book-club` is packaged today, and the client has
 * no kit-install path at all — so these are a forward contract with the kit
 * work rather than something resolvable now. Recording the id is all this
 * screen does; provisioning happens later in onboarding.
 *
 * The set and their ordering come from the capability-matrix spike, which
 * checked each against what an agent can actually do today and put meals first
 * because it is the only one whose core loop needs nothing that does not exist.
 */

export type StarterOption = {
  /** Kit id recorded on selection. */
  id: string;
  label: string;
  description: string;
  /** Present on at most one option; drives the recommended badge. */
  recommendationLabel?: string;
};

export const STARTER_OPTIONS: StarterOption[] = [
  {
    id: 'meal-plan',
    label: 'Weekly meals and grocery list',
    description: "Plan the week's dinners and keep a shared list",
    recommendationLabel: 'Recommended',
  },
  {
    id: 'household-tasks',
    label: 'Household tasks and routines',
    description: 'Split chores and keep recurring routines running',
  },
  {
    id: 'garden-plan',
    label: 'Garden plan and seasonal reminders',
    description: 'Plan what to plant and get nudged in season',
  },
];

export function buildStarterOptions(): StarterOption[] {
  return STARTER_OPTIONS;
}

/** The option a fresh screen should land on. */
export function defaultStarterOptionId(): string {
  const recommended = STARTER_OPTIONS.find(
    (option) => option.recommendationLabel
  );
  return (recommended ?? STARTER_OPTIONS[0]).id;
}

export function isStarterOptionId(value: string | undefined): boolean {
  return STARTER_OPTIONS.some((option) => option.id === value);
}

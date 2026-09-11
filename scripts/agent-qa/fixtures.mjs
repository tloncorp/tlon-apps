// Reviewed setup/test recipes. Model output selects recipes, never shell code.
export const fixtureCatalog = {
  'chat-v1': {
    description:
      'Disposable ~zod/~ten ships with a unique group and writable chat channel. A peer message is verified on ~zod before launch. The device agent may send and edit its own messages inside this exact chat, including multiline text and code blocks. Does not provide large history, DMs, or controlled event timing.',
    source: ['packages/tlon-bot-e2e/src/tlon/actor.ts'],
  },
  'notes-v1': {
    description:
      'Disposable ~zod/~ten ships with a group-linked %notes notebook, populated and empty folders, a short editable QA Note 01, long QA Note 02 and additional notes, and verified search. The device agent may create/edit within this fixture. Current group notes give readers write access; an independent read-only role cannot be provisioned through this backend API.',
    source: [
      'packages/shared/src/logic/notesPermissionsCompat.ts',
      'packages/api/src/client/notesApi.ts',
    ],
  },
};
export const regressionCatalog = {
  'reply-snapshot': {
    file: 'packages/shared/src/store/sync/sync.test.ts',
    filter: 'does not double-count a reply when the snapshot arrives',
    cwd: 'packages/shared',
    description:
      'Executes the real database/sync regression for sequential and concurrent snapshot/reply delivery, a new reply, and its duplicate. This is not simulator evidence.',
  },
  'notes-action-gates': {
    file: 'packages/app/ui/components/NotesChannel/NotesHeaderActions.test.ts',
    cwd: 'packages/app',
    description:
      'Component-action tests for edit-permission and search-capability visibility combinations. Covers unsupported backend combinations without claiming device coverage.',
  },
};
export function verifySetupPlan(plan) {
  if (
    !plan.setup ||
    !Array.isArray(plan.setup.fixtures) ||
    plan.setup.fixtures.some((id) => !fixtureCatalog[id])
  )
    throw new Error('Assessment must select known fixture recipes');
  for (const scenario of plan.scenarios) {
    if (!['simulator', 'regression', 'unavailable'].includes(scenario.method))
      throw new Error('Unknown test method');
    if (
      scenario.fixture !== 'none' &&
      !plan.setup.fixtures.includes(scenario.fixture)
    )
      throw new Error('Scenario fixture was not requested');
    if (
      scenario.method === 'regression' &&
      !regressionCatalog[scenario.regression]
    )
      throw new Error('Unknown regression recipe');
    if (scenario.method !== 'regression' && scenario.regression !== 'none')
      throw new Error('Simulator check cannot claim regression evidence');
  }
  return plan;
}

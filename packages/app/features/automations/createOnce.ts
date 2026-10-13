/**
 * Creating a task is the one edit that is not safe to repeat. Until the bot
 * has answered a create, asking for the same task again goes out under the
 * request id it first went out with: the owner's ship answers an id it holds
 * from its record and never relays it twice.
 *
 * The ids are kept outside any screen, so a dropped connection, a request
 * still pending, or leaving the editor and coming back does not lose one.
 */
export function makeCreateOnce<Task, Result>({
  newRequestId,
  send,
  isAnswer,
}: {
  newRequestId: () => string;
  send: (request: {
    bot: string;
    task: Task;
    requestId: string;
  }) => Promise<Result>;
  /** Whether a failure is the bot's own answer, which ends the request. */
  isAnswer: (error: unknown) => boolean;
}) {
  const unanswered = new Map<
    string,
    { bot: string; task: Task; requestId: string }
  >();

  async function createOnce(bot: string, task: Task): Promise<Result> {
    const key = `${bot}\n${JSON.stringify(task)}`;
    const requestId = unanswered.get(key)?.requestId ?? newRequestId();
    unanswered.set(key, { bot, task, requestId });
    // A request forgotten while this one was out may have been replaced by a
    // newer one under the same key, which this answer does not settle.
    const settle = () => {
      if (unanswered.get(key)?.requestId === requestId) unanswered.delete(key);
    };
    try {
      const result = await send({ bot, task, requestId });
      settle();
      return result;
    } catch (error) {
      if (isAnswer(error)) settle();
      throw error;
    }
  }

  /**
   * Drops a bot's unanswered creates that `matches` picks out, so the next
   * create of such a task is a new request. For a task that was created
   * after all and has since been deleted: asking for it again must not be
   * answered from the first request's record.
   */
  createOnce.forget = (bot: string, matches: (task: Task) => boolean) => {
    for (const [key, request] of unanswered) {
      if (request.bot === bot && matches(request.task)) unanswered.delete(key);
    }
  };

  return createOnce;
}

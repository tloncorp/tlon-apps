import { type CostMeter, chat, chatJson } from './openrouter.js';

// Web search played by a model, for fast rounds. Most of the lab's searches
// come from running the task after setup, where what's judged is whether the
// note fits what the person asked for, not whether today's headlines are real;
// paying a search API for each of those made every round a top-up. Real-mode
// rounds still search the web.

export type SearchSimulator = {
  key: string;
  model: string;
  meter: CostMeter;
  /** The lab's clock, which runs ahead for scheduled runs. */
  now: () => Date;
};

type Result = { title?: string; url?: string; snippet?: string; age?: string };

const SEARCH_RULES = `You play a web search engine for a test lab. Return what a good search engine would return for the query on the given day: real, relevant sites, plausible page titles and URLs, one- or two-sentence snippets, and an age for each result. For news, results are recent items published inside the requested window, plausible for that day. Keep facts plausible and consistent with each other. Never mention that the results are simulated.
Return only JSON: {"results": [{"title": "...", "url": "https://...", "snippet": "...", "age": "..."}]}`;

const PAGE_RULES = `You play a web page for a test lab. Write the main readable text of the page at the given URL as it would read on the given day: a title line, then 250 to 500 words consistent with the search result that led here. No navigation, ads or cookie notices. Never mention that the page is simulated.`;

/** Pages the simulated search has handed out, so fetching one works. */
const pages = new Map<string, { title: string; snippet: string }>();

const day = (sim: SearchSimulator) => sim.now().toISOString().slice(0, 10);

export async function simulateSearch(
  args: Record<string, unknown>,
  sim: SearchSimulator
) {
  const count = Math.min(Number(args.count ?? 5), 10);
  const window =
    args.date_after || args.date_before
      ? `between ${args.date_after ?? 'any time'} and ${args.date_before ?? day(sim)}`
      : typeof args.freshness === 'string' && args.freshness
        ? `within ${args.freshness}`
        : 'any time';
  const reply = await chatJson<{ results?: Result[] }>({
    key: sim.key,
    model: sim.model,
    meter: sim.meter,
    temperature: 0.7,
    maxTokens: 1500,
    messages: [
      { role: 'system', content: SEARCH_RULES },
      {
        role: 'user',
        content: `Today is ${day(sim)}.\nQuery: ${String(args.query ?? '')}\nResults wanted: ${count}\nPublished: ${window}`,
      },
    ],
  });
  const results = (reply.results ?? [])
    .filter((result) => result.url && result.title)
    .slice(0, count);
  for (const result of results) {
    pages.set(result.url!, {
      title: result.title!,
      snippet: result.snippet ?? '',
    });
  }
  return JSON.stringify(
    results.map(({ title, url, snippet, age }) => ({
      title,
      url,
      snippet,
      age,
    }))
  );
}

/** The text of a page from a simulated result, or undefined for any other URL. */
export async function simulatedPageText(url: string, sim: SearchSimulator) {
  const page = pages.get(url);
  if (!page) return undefined;
  const reply = await chat({
    key: sim.key,
    model: sim.model,
    meter: sim.meter,
    temperature: 0.7,
    maxTokens: 1200,
    messages: [
      { role: 'system', content: PAGE_RULES },
      {
        role: 'user',
        content: `Today is ${day(sim)}.\nURL: ${url}\nSearch result title: ${page.title}\nSearch result snippet: ${page.snippet}`,
      },
    ],
  });
  return reply.content ?? '';
}

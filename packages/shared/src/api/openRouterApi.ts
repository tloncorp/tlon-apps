/**
 * OpenRouter API integration for AI-powered message summarization
 */

const OPENROUTER_API_KEY = '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';
const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';

const SUMMARIZATION_PROMPT = `System: You are an expert technical conversation summarizer for Urbit developers.
Prioritize conciseness—every word must add value. Preserve exact technical
terminology, @p ship names, error messages, and code snippets verbatim. Target
150-250 words. Use bullet points over paragraphs. Avoid filler phrases like
"the conversation discusses."

User: Summarize this technical discussion in under 200 words:
[CONVERSATION]

Format as:
TOPIC: [1 sentence]
KEY POINTS: [3-5 bullets]
TECHNICAL DETAILS: [preserve code/errors exactly]
DECISIONS: [if any]
ACTION ITEMS: [with @p assignments]`;

export interface SummarizeMessageParams {
  messageText: string;
}

export interface SummarizeMessageResponse {
  summary: string;
  error?: string;
}

/**
 * Summarizes a message using OpenRouter's API
 */
export async function summarizeMessage({
  messageText,
}: SummarizeMessageParams): Promise<SummarizeMessageResponse> {
  try {
    const prompt = SUMMARIZATION_PROMPT.replace('[CONVERSATION]', messageText);

    const response = await fetch(OPENROUTER_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'HTTP-Referer': 'https://tlon.io',
        'X-Title': 'Tlon Messenger',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'deepseek/deepseek-chat-v3.1:free',
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenRouter API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();

    if (!data.choices || data.choices.length === 0) {
      throw new Error('No response from OpenRouter API');
    }

    const summary = data.choices[0].message?.content;

    if (!summary) {
      throw new Error('Empty summary received from OpenRouter API');
    }

    return { summary };
  } catch (error) {
    console.error('Error summarizing message:', error);
    return {
      summary: '',
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}

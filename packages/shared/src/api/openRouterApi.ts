/**
 * OpenRouter API integration for AI-powered message summarization
 */

import { getConstants } from '../domain/constants';

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';

const SUMMARIZATION_PROMPT = `Summarize this software development technical conversation concisely. Each message shows the author's user ID.

Instructions:
- Keep summary under 200 words
- Use bullet points
- Preserve technical terms, ship names (~zod, ~bus), and code exactly
- Focus on key points and decisions

Conversation:

[CONVERSATION]

Format:
TOPIC: [one sentence]
KEY POINTS: [3-5 bullets]
TECHNICAL DETAILS: [code/errors if present]
DECISIONS: [if any]
ACTION ITEMS: [if any]`;

export interface SummarizeMessageParams {
  messageText: string;
}

export interface SummarizeMessageResponse {
  summary: string;
  error?: string;
}

/**
 * Summarizes a message using OpenRouter's API
 * @throws {Error} If OPENROUTER_API_KEY is not configured
 */
export async function summarizeMessage({
  messageText,
}: SummarizeMessageParams): Promise<SummarizeMessageResponse> {
  const constants = getConstants();

  if (!constants.OPENROUTER_API_KEY || constants.OPENROUTER_API_KEY.length === 0) {
    throw new Error(
      'OPENROUTER_API_KEY is not configured. Set VITE_OPENROUTER_API_KEY environment variable.'
    );
  }

  try {
    const prompt = SUMMARIZATION_PROMPT.replace('[CONVERSATION]', messageText);

    const response = await fetch(OPENROUTER_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${constants.OPENROUTER_API_KEY}`,
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
        temperature: 0.3,
        max_tokens: 900,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();

      if (response.status === 429) {
        throw new Error('AI provider is rate-limited. Please try again in a few moments.');
      }

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

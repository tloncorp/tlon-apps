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
  errorDetails?: {
    message: string;
    name: string;
    stack?: string;
    responseStatus?: number;
    responseText?: string;
    responseData?: any;
    responseHeaders?: Record<string, string>;
  };
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
      'OPENROUTER_API_KEY is not configured. Please set either OPENROUTER_API_KEY (native/mobile) or VITE_OPENROUTER_API_KEY (web) environment variable.'
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
        model: 'amazon/nova-2-lite-v1:free',
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
      let errorData = null;

      // Try to parse error response as JSON
      try {
        errorData = JSON.parse(errorText);
      } catch {
        // If parsing fails, errorData stays null
      }

      if (response.status === 429) {
        throw new Error('AI provider is rate-limited. Please try again in a few moments.');
      }

      const error = new Error(`OpenRouter API error: ${response.status} - ${errorText}`);
      // Attach additional context for PostHog tracking
      (error as any).responseStatus = response.status;
      (error as any).responseText = errorText;
      (error as any).responseData = errorData;
      (error as any).responseHeaders = Object.fromEntries(response.headers.entries());
      throw error;
    }

    const data = await response.json();

    if (!data.choices || data.choices.length === 0) {
      const error = new Error('No response from OpenRouter API');
      (error as any).responseData = data;
      throw error;
    }

    const summary = data.choices[0].message?.content;

    if (!summary) {
      const error = new Error('Empty summary received from OpenRouter API');
      (error as any).responseData = data;
      throw error;
    }

    return { summary };
  } catch (error) {
    console.error('Error summarizing message:', error);

    // Extract all error details for logging
    const errorDetails: any = {
      message: error instanceof Error ? error.message : 'Unknown error occurred',
      name: error instanceof Error ? error.name : 'UnknownError',
      stack: error instanceof Error ? error.stack : undefined,
    };

    // Include additional properties if they exist
    if (error && typeof error === 'object') {
      const errorObj = error as any;
      if (errorObj.responseStatus) errorDetails.responseStatus = errorObj.responseStatus;
      if (errorObj.responseText) errorDetails.responseText = errorObj.responseText;
      if (errorObj.responseData) errorDetails.responseData = errorObj.responseData;
      if (errorObj.responseHeaders) errorDetails.responseHeaders = errorObj.responseHeaders;
    }

    return {
      summary: '',
      error: errorDetails.message,
      errorDetails, // Include full details for PostHog
    };
  }
}

/**
 * LLM API integration for AI-powered message summarization
 *
 * Uses serverless endpoint to interface with LLM provider
 */

import { createDevLogger } from '../debug';
import { getConstants } from '../domain';
import { getSetting } from './settingsApi';

const logger = createDevLogger('llmApi', false);

const SUMMARIZATION_PROMPT = `Summarize this software development technical conversation concisely. Each message shows the author's user ID.

Instructions:
- Keep summary under 200 words
- Use bullet points
- Preserve technical terms, ship names (~zod, ~bus), and code exactly
- Focus on key points and decisions

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
 * Formats conversation text into message objects for the LLM API
 * Expected format: "~author1: message1\n\n~author2: message2\n\n..."
 */
function formatMessagesForLLM(conversationText: string): Array<{
  author: string;
  content: string;
}> {
  const messages: Array<{ author: string; content: string }> = [];

  // Split by double newlines to separate messages
  const rawMessages = conversationText.split('\n\n');

  for (const msg of rawMessages) {
    const trimmed = msg.trim();
    if (!trimmed) continue;

    // Check for author: content format
    const colonIndex = trimmed.indexOf(':');
    if (colonIndex > 0) {
      const author = trimmed.substring(0, colonIndex).trim();
      const content = trimmed.substring(colonIndex + 1).trim();
      if (content) {
        messages.push({ author, content });
      }
    } else {
      // Message without author prefix, treat as system message
      messages.push({ author: 'system', content: trimmed });
    }
  }

  return messages;
}

/**
 * Summarizes a message using the serverless LLM API endpoint
 */
export async function summarizeMessage({
  messageText,
}: SummarizeMessageParams): Promise<SummarizeMessageResponse> {
  const constants = getConstants();

  if (!constants.TLON_LLM_ENDPOINT || constants.TLON_LLM_ENDPOINT.length === 0) {
    throw new Error(
      'TLON_LLM_ENDPOINT is not configured. Please set the environment variable.'
    );
  }

  try {
    const messages = formatMessagesForLLM(messageText);

    // Get LLM service auth key from user's settings
    const llmServiceKey = await getSetting('llmservice');

    logger.log('Calling LLM API', {
      endpoint: constants.TLON_LLM_ENDPOINT,
      messageCount: messages.length,
      hasAuthKey: !!llmServiceKey,
    });

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    // Add authorization header if key exists
    if (llmServiceKey) {
      headers['Authorization'] = `Bearer ${llmServiceKey}`;
    }

    const response = await fetch(`${constants.TLON_LLM_ENDPOINT}/gemini`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        prompt: SUMMARIZATION_PROMPT,
        messages,
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

      const error = new Error(`LLM API error: ${response.status} - ${errorText}`);
      // Attach additional context for PostHog tracking
      (error as any).responseStatus = response.status;
      (error as any).responseText = errorText;
      (error as any).responseData = errorData;
      (error as any).responseHeaders = Object.fromEntries(response.headers.entries());
      throw error;
    }

    const data = await response.json();

    if (!data.success) {
      const error = new Error('LLM API returned unsuccessful response');
      (error as any).responseData = data;
      throw error;
    }

    if (!data.result) {
      const error = new Error('Empty result received from LLM API');
      (error as any).responseData = data;
      throw error;
    }

    logger.log('LLM API response received', {
      resultLength: data.result.length,
    });

    return { summary: data.result };
  } catch (error) {
    console.error('Error summarizing message with LLM:', error);

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

#!/usr/bin/env npx ts-node

/**
 * Post to a Tlon notebook (diary channel)
 *
 * Usage:
 *   npx ts-node scripts/notebook-post.ts <nest> <title> [--image <url>] [--content <json-file>] [--stdin] [--markdown <file>] [--markdown-stdin]
 *
 * Examples:
 *   npx ts-node scripts/notebook-post.ts diary/~host/channel "My Post Title"
 *   npx ts-node scripts/notebook-post.ts diary/~host/channel "My Post" --image https://example.com/cover.png
 *   npx ts-node scripts/notebook-post.ts diary/~host/channel "My Post" --content story.json
 *   npx ts-node scripts/notebook-post.ts diary/~host/channel "My Post" --markdown article.md
 *
 * If no explicit content is provided, creates a post with a title and empty body.
 * --content and --stdin accept Story JSON. Use --markdown or --markdown-stdin
 * for Markdown input.
 */
import { getCurrentUserId, sendPost } from '@tloncorp/api';
import type { Story } from '@tloncorp/api';
import * as fs from 'fs';

import { ensureClient } from './api-client';
import {
  getRequiredOptionValue,
  isCommandHelpRequest,
  printErrorAndExit,
  printHelpAndExit,
  printUsageAndExit,
} from './cli-utils';
import {
  type NotebookStory,
  normalizeNotebookContent,
} from './notebook-content';
import { markdownToStory } from './story';

interface PostResult {
  success: boolean;
  error?: string;
  messageId?: string;
}

const NOTEBOOK_HELP = `Usage: tlon notebook <nest> <title> [options]

Arguments:
  nest    Diary channel nest (e.g., diary/~host/channel-name)
  title   Post title

Options:
  --image <url>     Cover image URL
  --content <file>  JSON file with Story JSON
  --stdin           Read Story JSON from stdin
  --markdown <file> Markdown file to convert to Story
  --markdown-stdin  Read Markdown from stdin

If no content is provided, creates a post with a title and empty body.

Examples:
  tlon notebook diary/~host/notes "Hello World"
  tlon notebook diary/~host/notes "My Post" --image https://example.com/img.png
  echo '[{"inline":["Hello!"]}]' | tlon notebook diary/~host/notes "Test" --stdin
  tlon notebook diary/~host/notes "Markdown Post" --markdown post.md`;

function toApiStory(content: NotebookStory): Story {
  return content as unknown as Story;
}

export async function postToNotebook(
  nest: string,
  title: string,
  content: NotebookStory,
  image?: string
): Promise<PostResult> {
  const authorId = getCurrentUserId();
  const sentAt = Date.now();

  try {
    await sendPost({
      channelId: nest,
      authorId,
      sentAt,
      content: toApiStory(content),
      metadata: {
        title,
        description: '',
        image: image || '',
        cover: '',
      },
    });

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// CLI handling
async function main() {
  const args = process.argv.slice(2);

  if (isCommandHelpRequest(args)) {
    printHelpAndExit(NOTEBOOK_HELP);
  }

  if (args.length < 2) {
    printUsageAndExit(NOTEBOOK_HELP);
  }

  const nest = args[0];
  const title = args[1];

  let image: string | undefined;
  let content: NotebookStory = [];
  let contentSource: string | undefined;

  const claimContentSource = (source: string) => {
    if (contentSource) {
      throw new Error(
        `Only one content source can be provided (${contentSource} and ${source})`
      );
    }
    contentSource = source;
  };

  const readStdin = async (): Promise<string> => {
    const chunks: Buffer[] = [];
    for await (const chunk of process.stdin) {
      chunks.push(chunk);
    }
    return Buffer.concat(chunks).toString('utf-8');
  };

  for (let i = 2; i < args.length; i++) {
    if (args[i] === '--image') {
      image = getRequiredOptionValue(args, i);
      i++;
    } else if (args[i] === '--content') {
      claimContentSource('--content');
      const file = getRequiredOptionValue(args, i);
      const data = fs.readFileSync(file, 'utf-8');
      content = normalizeNotebookContent(JSON.parse(data));
      i++;
    } else if (args[i] === '--stdin') {
      claimContentSource('--stdin');
      const data = await readStdin();
      content = normalizeNotebookContent(JSON.parse(data));
    } else if (args[i] === '--markdown') {
      claimContentSource('--markdown');
      const file = getRequiredOptionValue(args, i);
      const data = fs.readFileSync(file, 'utf-8');
      content = markdownToStory(data);
      i++;
    } else if (args[i] === '--markdown-stdin') {
      claimContentSource('--markdown-stdin');
      const data = await readStdin();
      content = markdownToStory(data);
    } else {
      throw new Error(`Unknown option: ${args[i]}`);
    }
  }

  console.log(`Posting to: ${nest}`);
  console.log(`Title: ${title}`);
  if (image) console.log(`Image: ${image}`);

  await ensureClient(['channels']);
  const result = await postToNotebook(nest, title, content, image);

  if (result.success) {
    console.log(`✓ Posted successfully!`);
    process.exit(0);
  } else {
    console.error(`✗ Failed: ${result.error}`);
    process.exit(1);
  }
}

main().catch(printErrorAndExit);

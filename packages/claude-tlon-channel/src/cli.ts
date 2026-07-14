/**
 * Outbound sends and history reads via the `tlon` CLI from
 * @tloncorp/tlon-skill. The CLI owns the gnarly parts (story format,
 * threading, target parsing), so this server doesn't reimplement them.
 */
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import type { ServerConfig } from './config.js';

const execFileAsync = promisify(execFile);

export class TlonCli {
  constructor(private readonly cfg: ServerConfig) {}

  private async run(args: string[]): Promise<string> {
    try {
      const { stdout } = await execFileAsync(this.cfg.cliCommand, args, {
        env: {
          ...process.env,
          URBIT_URL: this.cfg.url,
          URBIT_SHIP: this.cfg.ship,
          URBIT_CODE: this.cfg.code,
        },
        timeout: 60_000,
        maxBuffer: 4 * 1024 * 1024,
      });
      return stdout.trim();
    } catch (err) {
      const error = err as { stderr?: string; message?: string };
      throw new Error(
        `tlon ${args[0] ?? ''} failed: ${error.stderr?.trim() || error.message}`
      );
    }
  }

  /** target: channel nest (chat/~host/slug), ~ship for 1:1 DM, or 0v club id */
  async send(target: string, text: string): Promise<string> {
    if (target.startsWith('0v')) {
      return this.run(['dms', 'send', target, text]);
    }
    return this.run(['posts', 'send', target, text]);
  }

  async reply(target: string, parentId: string, text: string): Promise<string> {
    if (target.startsWith('0v')) {
      return this.run(['dms', 'reply', target, parentId, text]);
    }
    return this.run(['posts', 'reply', target, parentId, text]);
  }

  async readChannel(nest: string, limit: number): Promise<string> {
    return this.run([
      'messages',
      'channel',
      nest,
      '--limit',
      String(Math.min(limit, 50)),
    ]);
  }

  async readDm(whom: string, limit: number): Promise<string> {
    return this.run([
      'messages',
      'dm',
      whom,
      '--limit',
      String(Math.min(limit, 50)),
    ]);
  }

  /** Fetch a single post with its thread replies. */
  async readThread(nest: string, postId: string): Promise<string> {
    return this.run(['messages', 'post', nest, postId]);
  }
}

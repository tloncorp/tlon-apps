import { asRecord, extractStoryText } from './story.js';

export type InboundTlonMessage = {
  key: string;
  kind: 'dm' | 'channel';
  target: string;
  sender: string;
  messageId: string;
  text: string;
};

export type RoutingPolicy = {
  botShip: string;
  ownerShip: string;
  allowedDmShips?: Iterable<string>;
  allowedChannelShips?: Iterable<string>;
  channels?: Iterable<string>;
  mentions?: Iterable<string>;
  requireChannelMention?: boolean;
  ownerListen?: boolean;
};

export class TlonRouter {
  private readonly botShip: string;
  private readonly ownerShip: string;
  private readonly allowedDmShips: Set<string>;
  private readonly allowedChannelShips: Set<string>;
  private readonly channels: Set<string>;
  private readonly mentions: string[];
  private readonly seen = new BoundedSet(2_000);

  constructor(private readonly policy: RoutingPolicy) {
    this.botShip = normalizeShip(policy.botShip);
    this.ownerShip = normalizeShip(policy.ownerShip);
    this.allowedDmShips = normalizedSet([
      this.ownerShip,
      ...(policy.allowedDmShips ?? []),
    ]);
    this.allowedChannelShips = normalizedSet([
      this.ownerShip,
      ...(policy.allowedChannelShips ?? []),
    ]);
    this.channels = new Set(policy.channels ?? []);
    this.mentions = [
      `~${this.botShip}`,
      `@${this.botShip}`,
      ...(policy.mentions ?? []),
    ].map((mention) => mention.toLowerCase());
  }

  parseChat(event: unknown): InboundTlonMessage | null {
    if (Array.isArray(event)) return null;
    const root = asRecord(event);
    const whom = typeof root.whom === 'string' ? root.whom : '';
    const response = asRecord(root.response);
    const add = asRecord(response.add);
    const reply = asRecord(response.reply);
    const replyEssay = asRecord(
      asRecord(asRecord(reply.delta).add)['reply-essay']
    );
    const essay =
      Object.keys(add).length > 0 ? asRecord(add.essay) : replyEssay;
    if (Object.keys(essay).length === 0) return null;

    const author = normalizeAuthor(essay.author);
    const partner = normalizeShip(extractDmPartner(whom) || author);
    if (!author || author === this.botShip) return null;
    if (!this.allowedDmShips.has(author) && !this.allowedDmShips.has(partner)) {
      return null;
    }
    const text = extractStoryText(essay.content);
    const messageId = stringValue(reply.id) || stringValue(root.id);
    if (!text || !messageId || !this.seen.add(messageId)) return null;
    return {
      key: `dm:${partner}`,
      kind: 'dm',
      target: whom || `~${partner}`,
      sender: author,
      messageId,
      text,
    };
  }

  parseChannel(event: unknown): InboundTlonMessage | null {
    const root = asRecord(event);
    const nest = stringValue(root.nest);
    if (!nest || !this.channels.has(nest)) return null;
    const post = asRecord(asRecord(root.response).post);
    const rPost = asRecord(post['r-post']);
    const reply = asRecord(rPost.reply);
    const replyEssay = asRecord(
      asRecord(asRecord(reply['r-reply']).set)['reply-essay']
    );
    const essay = Object.keys(replyEssay).length
      ? replyEssay
      : asRecord(asRecord(rPost.set).essay);
    const author = normalizeAuthor(essay.author);
    if (
      !author ||
      author === this.botShip ||
      !this.allowedChannelShips.has(author)
    ) {
      return null;
    }
    const messageId = stringValue(reply.id) || stringValue(post.id);
    let text = extractStoryText(essay.content);
    if (!messageId || !text || !this.seen.add(`${nest}:${messageId}`))
      return null;

    const mentioned = this.mentions.some((mention) =>
      text.toLowerCase().includes(mention)
    );
    const host = normalizeShip(nest.split('/')[1] ?? '');
    const ownerCanSpeak =
      this.policy.ownerListen !== false &&
      author === this.ownerShip &&
      (host === this.ownerShip || host === this.botShip);
    if (
      this.policy.requireChannelMention !== false &&
      !mentioned &&
      !ownerCanSpeak
    ) {
      return null;
    }
    for (const mention of this.mentions) {
      text = text
        .replaceAll(new RegExp(escapeRegExp(mention), 'gi'), '')
        .trim();
    }
    if (!text) return null;
    return {
      key: `channel:${nest}`,
      kind: 'channel',
      target: nest,
      sender: author,
      messageId,
      text,
    };
  }
}

function normalizeAuthor(value: unknown): string {
  if (typeof value === 'string') return normalizeShip(value);
  return normalizeShip(stringValue(asRecord(value).ship));
}

function extractDmPartner(whom: string): string {
  const match = whom.match(/~([a-z0-9-]+)/);
  return match?.[1] ?? '';
}

export function normalizeShip(value: string): string {
  return value.trim().toLowerCase().replace(/^~/, '');
}

function normalizedSet(values: Iterable<string>): Set<string> {
  return new Set([...values].map(normalizeShip).filter(Boolean));
}

function stringValue(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

class BoundedSet {
  private readonly values = new Map<string, true>();

  constructor(private readonly limit: number) {}

  add(value: string): boolean {
    if (this.values.has(value)) return false;
    this.values.set(value, true);
    if (this.values.size > this.limit) {
      this.values.delete(this.values.keys().next().value as string);
    }
    return true;
  }
}

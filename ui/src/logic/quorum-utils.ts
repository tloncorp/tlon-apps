import { format, formatDistance } from 'date-fns';
import { produce } from 'immer';
import { stringToTa } from "@urbit/api";
import { strToSym } from './utils';
import { Group } from '@/types/groups';
import { BoardPost, PostVotes, PostEdit } from '@/types/quorum';
import {
  Inline,
  InlineKey,
  isBlockquote,
  isBreak,
  isBold,
  isInlineCode,
  isBlockCode,
  isItalics,
  isLink,
  isShip,
  isStrikethrough,
  Link,
} from '@/types/content';


export const REF_CHAT_REGEX = /^\/1\/chan\/chat\/(~[a-z0-9-]+)\/([a-z0-9-]+)\/msg\/(~[a-z0-9-]+)\/([1-9][0-9\.]*)$/;

export function calcScore(post: BoardPost): number {
  return Object.values(post.votes).reduce(
    (n, i) => n + (i === "up" ? 1 : -1),
    0
  );
}

export function calcScoreStr(post: BoardPost): string {
  const score = calcScore(post);
  return `${score >= 0 ? "+" : ""}${score}`;
}

export function getOriginalEdit(post: BoardPost): PostEdit {
  return post.history[post.history.length - 1];
}

export function getLatestEdit(post: BoardPost): PostEdit {
  return post.history[0];
}

export function getSnapshotAt(post: BoardPost, edit: number): BoardPost {
  return produce(post, ({history}: BoardPost) => {
    for (let i = 0; i < edit; i++) {
      history.shift();
    }
  });
}

/**
 * FIXME: Replace this function now that custom channel types have rolled out.
 */
export function isGroupAdmin(group: Group): boolean {
  const vessel = group.fleet?.[window.our];
  return vessel && vessel.sects.includes("admin");
}

/**
 * FIXME: Is there a better way to do this with just the `landscape-apps` source
 * functions?
 */
export function isChatRef(text: string) {
  return REF_CHAT_REGEX.test(text);
}

export function makeTerseDate(date: Date) {
  return format(date, 'yy/MM/dd');
}

export function makeTerseDateAndTime(date: Date) {
  return format(date, 'yy/MM/dd HH:mm');
}

export function makePrettyLapse(date: Date) {
  return formatDistance(date, Date.now(), {addSuffix: true})
    .replace(/ a /, ' 1 ')
    .replace(/less than /, '<')
    .replace(/about /, '~')
    .replace(/almost /, '<~')
    .replace(/over /, '>~');
}

export function makeTerseLapse(date: Date) {
  return formatDistance(date, Date.now(), {addSuffix: true})
    .replace(/ a /, ' 1 ')
    .replace(/less than /, '<')
    .replace(/about /, '~')
    .replace(/almost /, '<~')
    .replace(/over /, '>~')
    .replace(/ /, '').replace(/ago/, '')
    .replace(/minute(s)?/, 'm')
    .replace(/hour(s)?/, 'h')
    .replace(/day(s)?/, 'D')
    .replace(/month(s)?/, 'M')
    .replace(/year(s)?/, 'Y');
}

/**
 * Given a channel title (e.g. "Apples and Oranges"), generate and return
 * a set of viable channel IDs (e.g. ["apples-and-oranges",
 * "apples-and-oranges-2"]).
 */
export function getChannelIdFromTitle(
  channel: string
): [string, string] {
  const titleIsNumber = Number.isInteger(Number(channel));
  const baseChannelName = titleIsNumber
    ? `channel-${channel}`
    : strToSym(channel).replace(/[^a-z]*([a-z][-\w\d]+)/i, '$1');
  const randomSmallNumber = Math.floor(Math.random() * 1000);

  return [baseChannelName, `${baseChannelName}-${randomSmallNumber}`];
}

export function encodeQuery(query: string): string {
  // NOTE: We trim here to avoid issues Urbit scry endpoints have with
  // encouded leading/trailing spaces.
  return stringToTa(query.trim().replace(/\s+/g, " ")).replace('~.', '~~');
}

export function decodeQuery(query: string): string {
  return taToString(query.replace('~~', '~.'));
}

/**
 * Converts a @ta-encded string into the raw equivalent. The inverse
 * function of 'stringToTa' from '@urbit/api'.
 */
export function taToString(str: string): string {
  let input = str.replace(/^~./, "");

  let output = "";
  while (input !== "") {
    if (input.match(/^~~/)) {
      output = output + "~";
      input = input.replace(/^~~/, "");
    } else if (input.match(/^~\./)) {
      output = output + ".";
      input = input.replace(/^~\./, "");
    } else if(input.match(/^\./)) {
      output = output + " ";
      input = input.replace(/^\./, "");
    } else if (input.match(/^~([0-9a-f]+)\./)) {
      const base16 = (input.match(/^~([0-9a-f]+)\./) || []).at(1) || "0x0";
      output = output + String.fromCharCode(parseInt(base16, 16));
      input = input.replace(/^~[0-9a-f]+\./, "");
    } else {
      output = output + input.charAt(0);
      input = input.slice(1);
    }
  }

  return output;

  // NOTE: Reference source for 'stringToTa' from '@urbit/api'
  //
  // let out = "";
  // for (let i = 0; i < str.length; i++) {
  //   const char = str[i];
  //   let add = "";
  //   switch (char) {
  //     case " ":
  //       add = ".";
  //       break;
  //     case ".":
  //       add = "~.";
  //       break;
  //     case "~":
  //       add = "~~";
  //       break;
  //     default:
  //       const charCode = str.charCodeAt(i);
  //       if (
  //         (charCode >= 97 && charCode <= 122) || // a-z
  //         (charCode >= 48 && charCode <= 57) || // 0-9
  //         char === "-"
  //       ) {
  //         add = char;
  //       } else {
  //         // TODO behavior for unicode doesn't match +wood's,
  //         //     but we can probably get away with that for now.
  //         add = "~" + charCode.toString(16) + ".";
  //       }
  //   }
  //   out = out + add;
  // }
  // return "~." + out;
}

/**
 * Given an inline string, generate a string with equivalent Markdown
 * annotations.
 */
export function inlineToMarkdown(inline: Inline): string {
  if (typeof inline === "string") {
    return inline;
  }

  if (isBreak(inline)) {
    return "\n";
  }

  if (isBold(inline)) {
    return inline.bold.map((i: Inline) => `**${inlineToMarkdown(i)}**`).join(" ");
  }

  if (isItalics(inline)) {
    return inline.italics.map((i: Inline) => `*${inlineToMarkdown(i)}*`).join(" ");
  }

  // TODO: Add support for strikethrough with a plugin?
  // `~~${inlineToMarkdown(i)}~~`
  if (isStrikethrough(inline)) {
    return inline.strike.map((i: Inline) => inlineToMarkdown(i)).join(" ");
  }

  // TODO: Should fixup links; simple links like `urbit.org` behave
  // weirdly and act as links internal to the application (e.g.
  // `/apps/quorum/.../urbit.org/` instead of `urbit.org`).
  if (isLink(inline)) {
    return `[${inline.link.content}](${inline.link.href})`;
  }

  // FIXME: This works, but is a little funky. Ideally, the import would
  // have a `> ` prefix for each link, but this interacts poorly with
  // newlines. Also, it"d be better if any newline broke up the quote,
  // but I think the current behavior is more standard for markdown.
  if (isBlockquote(inline)) {
    return Array.isArray(inline.blockquote)
      ? `> ${inline.blockquote.map((i) => inlineToMarkdown(i)).join(" ")}\n`
      : `> ${inline.blockquote}\n`;
  }

  if (isInlineCode(inline)) {
    return typeof inline["inline-code"] === "object"
      ? `\`${inlineToMarkdown(inline["inline-code"])}\``
      : `\`${inline["inline-code"]}\``;
  }

  if (isBlockCode(inline)) {
    return `\`\`\`\n${inlineToMarkdown(inline.code)}\n\`\`\`\n`;
  }

  // TODO: It would be better if this linked to the user's quorum
  // profile, but this is a bit hard to manage with channel anchors
  if (isShip(inline)) {
    return `[${inline.ship}](https://urbit.org/ids/${inline.ship})`;
  }

  return "";
}

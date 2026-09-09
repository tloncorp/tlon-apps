import type { PhrasingContent } from 'mdast';
import type {
  CompileContext,
  Extension as FromMarkdownExtension,
} from 'mdast-util-from-markdown';
import type {
  Code,
  Construct,
  Effects,
  Extension,
  State,
} from 'micromark-util-types';
import type { Processor } from 'unified';
import type { Literal } from 'unist';

declare module 'micromark-util-types' {
  interface TokenTypeMap {
    shipMention: 'shipMention';
  }
}

/**
 * Custom mdast node type for ship mentions (~zod, ~sampel-palnet, etc.)
 */
export interface ShipMention extends Literal {
  type: 'shipMention';
  value: string; // full matched source including the leading ~
}

// Characters that fuse with a preceding mention on reparse: the tokenizer's
// trailing boundary class plus the email-guard triggers. Serialize paths use
// it to decide where a content-neutral separator is needed after a mention.
export const SHIP_MENTION_FUSABLE_START = /^[A-Za-z0-9@._+-]/;

const TILDE = 126; // ~
const HYPHEN = 45; // -
const AT_SIGN = 64; // @
const DOT = 46; // .
const PLUS_SIGN = 43; // +
const UNDERSCORE = 95; // _

function lowercaseLetter(code: Code): boolean {
  return code !== null && code >= 97 && code <= 122;
}

function boundaryReject(code: Code): boolean {
  return (
    code === HYPHEN ||
    (code !== null &&
      ((code >= 48 && code <= 57) || (code >= 65 && code <= 90))) ||
    lowercaseLetter(code)
  );
}

// `-` plus exactly six lowercase letters, without consuming the code after.
const syllable: Construct = {
  tokenize: tokenizeSyllable,
  partial: true,
};

function tokenizeSyllable(effects: Effects, ok: State, nok: State): State {
  let count = 0;

  return start;

  function start(code: Code): State | undefined {
    if (code !== HYPHEN) return nok(code);
    effects.consume(code);
    return letters;
  }

  function letters(code: Code): State | undefined {
    if (count < 6 && lowercaseLetter(code)) {
      count += 1;
      effects.consume(code);
      return letters;
    }
    return count === 6 ? ok(code) : nok(code);
  }
}

// `--` plus exactly six lowercase letters, without consuming the code after.
const cometTail: Construct = {
  tokenize: tokenizeCometTail,
  partial: true,
};

function tokenizeCometTail(effects: Effects, ok: State, nok: State): State {
  let count = 0;
  let hyphens = 0;

  return start;

  function start(code: Code): State | undefined {
    if (code !== HYPHEN) return nok(code);
    hyphens += 1;
    effects.consume(code);
    return hyphens === 2 ? letters : start;
  }

  function letters(code: Code): State | undefined {
    if (count < 6 && lowercaseLetter(code)) {
      count += 1;
      effects.consume(code);
      return letters;
    }
    return count === 6 ? ok(code) : nok(code);
  }
}

// GFM autolink literals allow `~` directly before an email, so a lookahead
// consuming the email local part (`[A-Za-z0-9._+-]*`, succeeding iff it
// reaches `@`) lets the email construct claim the text instead of the
// mention splitting it.
const emailLocalPart: Construct = {
  tokenize: tokenizeEmailLocalPart,
  partial: true,
};

function tokenizeEmailLocalPart(
  effects: Effects,
  ok: State,
  nok: State
): State {
  return localPart;

  function localPart(code: Code): State | undefined {
    if (code === AT_SIGN) return ok(code);
    if (
      code === PLUS_SIGN ||
      code === HYPHEN ||
      code === DOT ||
      code === UNDERSCORE ||
      (code !== null &&
        ((code >= 48 && code <= 57) || (code >= 65 && code <= 90))) ||
      lowercaseLetter(code)
    ) {
      effects.consume(code);
      return localPart;
    }
    return nok(code);
  }
}

// Ship mention grammar: ~[a-z]{3,6}(-[a-z]{6})*(--[a-z]{6}(-[a-z]{6})*)?
// (a galaxy/star base, optional six-letter syllables, and an optional comet
// tail). Matching runs at tokenize time — not as a post-parse text scan —
// because that is the only point where backslash escapes and character
// references are still visible (the core escape/reference constructs consume
// them before this hook fires), and where a trailing boundary can reject
// candidates that run into word-like text (~zod2, ~foo-bar) instead of
// half-mentioning a different, real ship. Deliberately syntactic-only:
// @urbit/aura phonemic validation rejects test moons real users have.
const shipMentionConstruct: Construct = {
  tokenize: tokenizeShipMention,
};

function tokenizeShipMention(effects: Effects, ok: State, nok: State): State {
  let count = 0;
  let cometConsumed = false;

  return start;

  function start(code: Code): State | undefined {
    effects.enter('shipMention');
    effects.consume(code);
    return base;
  }

  function base(code: Code): State | undefined {
    if (count < 6 && lowercaseLetter(code)) {
      count += 1;
      effects.consume(code);
      return base;
    }
    return count >= 3 ? afterBase(code) : nok(code);
  }

  function afterBase(code: Code): State | undefined {
    if (code === HYPHEN) {
      return effects.attempt(syllable, afterBase, tryCometTail)(code);
    }
    return boundary(code);
  }

  function tryCometTail(code: Code): State | undefined {
    if (cometConsumed) return boundary(code);
    return effects.attempt(cometTail, afterCometBase, boundary)(code);
  }

  function afterCometBase(code: Code): State | undefined {
    cometConsumed = true;
    if (code === HYPHEN) {
      return effects.attempt(syllable, afterCometBase, boundary)(code);
    }
    return boundary(code);
  }

  function boundary(code: Code): State | undefined {
    // An incomplete token (~zod2, ~foo-bar, …) is rejected whole — no
    // partial mention. `@` and the local-part characters guard the GFM
    // email-autolink parity documented on the construct.
    if (boundaryReject(code) || code === AT_SIGN) return nok(code);
    if (code === DOT || code === PLUS_SIGN || code === UNDERSCORE) {
      return effects.check(emailLocalPart, nok, accept)(code);
    }
    return accept(code);
  }

  function accept(code: Code): State | undefined {
    effects.exit('shipMention');
    return ok(code);
  }
}

function shipMentionSyntax(): Extension {
  return { text: { [TILDE]: shipMentionConstruct } };
}

function shipMentionFromMarkdown(): FromMarkdownExtension {
  return {
    enter: {
      shipMention(this: CompileContext, token) {
        this.enter(
          { type: 'shipMention', value: '' } as unknown as PhrasingContent,
          token
        );
      },
    },
    exit: {
      shipMention(this: CompileContext, token) {
        const node = this.stack[
          this.stack.length - 1
        ] as unknown as ShipMention;
        node.value = this.sliceSerialize(token);
        this.exit(token);
      },
    },
  };
}

/**
 * remark plugin that adds ship mention parsing support. Registers the
 * micromark syntax extension and the mdast-util-from-markdown handlers on
 * the processor data, which remark-parse reads at parse time.
 */
export function remarkShipMentions(this: Processor) {
  const data = this.data();
  (data.micromarkExtensions ??= []).push(shipMentionSyntax());
  (data.fromMarkdownExtensions ??= []).push(shipMentionFromMarkdown());
}

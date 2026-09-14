import { createHash } from 'node:crypto';

import ts from 'typescript';

import { Tree } from './git';

export type Surface = 'scry' | 'subscribe' | 'poke' | 'thread' | 'http';

export interface SourceLocation {
  file: string;
  line: number;
}

/**
 * A request path as far as extraction could resolve it. `known` is the leading
 * run of fixed segments; `unknownTail` is unbounded in value *and segment
 * count*, because an interpolation does not stop at a slash — a `groupId` is
 * `~ship/name` and occupies two segments.
 */
export interface PathPattern {
  known: string[];
  unknownTail: boolean;
  text: string;
  /**
   * The whole path with each interpolation written as a `{…}` hole. Identity
   * turns on this, not on `known`, so `/chan/${id}` and
   * `/chan/${id}/new-feature` stay separate requests — otherwise a new call
   * would inherit an older one's known-gaps.json exemption.
   *
   * The hole is `{}` only for a plain identifier chain. Anything else is
   * hashed over its whole text, because a suffix can be moved inside the
   * expression (`` `/chan/${id + '/new'}` ``) and must not collapse onto the
   * shorter shape. Literal braces are percent-escaped, so a literal can never
   * spell a hole.
   */
  shape?: string;
}

/** One thing the client asks of the desk, at one call site. */
export interface Dependency {
  /** Stable identity: surface + app + path/mark. The report key. */
  key: string;
  surface: Surface;
  app: string | null;
  path: PathPattern | null;
  mark: string | null;
  thread: string | null;
  site: SourceLocation;
  /** Verbatim source text of the argument this record came from. */
  text: string;
  /** Guard text when this record is one branch of a conditional. */
  guard?: string;
  /** Set when extraction could not resolve it; forces UNVERIFIED. */
  unresolved?: string;
}

const set = (names: string) => new Set(names.split(' '));

/**
 * Directories scanned for ship call sites — every tree the shipped app is
 * built from, so both app entry points are here. `tlon-skill`, `openclaw`,
 * `hermes-tlon-adapter` and `tlon-bot-e2e` are separately packaged tooling
 * that `ci.yml` already treats as unconsumed by the app, so they are out of
 * scope.
 */
export const CLIENT_ROOTS = [
  'packages/api/src',
  'packages/shared/src',
  'packages/app',
  'apps/tlon-web/src',
  'apps/tlon-mobile/src',
];

/**
 * Module specifiers that deliver a wrapper by name. Binding is by *source*,
 * not by name: a local called `poke` that came from somewhere else is not a
 * ship call, and a wrapper renamed on import still is.
 */
const WRAPPER_SPECIFIERS = set(
  './urbit ../urbit ../client/urbit ./client/urbit @tloncorp/api ' +
    '@tloncorp/api/client @tloncorp/api/client/urbit @tloncorp/api/api/urbit'
);
/** The web app's own legacy client (`apps/tlon-web/src/api.ts`). */
const WEB_CLIENT_SPECIFIERS = set('@/api ../api ../../api');

const WRAPPERS = set(
  'subscribe subscribeOnce poke pokeNoun trackedPoke trackedPokeNoun ' +
    'scry scryNoun thread requestJson request'
);

/**
 * Poke-params builders expanded one hop, following transitive forwarding
 * (`channelPostAction` returns `channelAction(...)`, not an object literal).
 */
export const HELPER_WHITELIST = set(
  'groupAction groupNavigationBatchUpdate chatAction channelAction ' +
    'channelPostAction activityAction stewardGatewayAction multiDmAction'
);

/** Files that *define* the wrappers, rather than calling them. */
const DEFINITION_FILES = [
  'packages/api/src/client/urbit.ts',
  'packages/api/src/http-api/',
  'apps/tlon-web/src/api.ts',
];

const isSkipped = (file: string) =>
  DEFINITION_FILES.some((d) => file === d || file.startsWith(d)) ||
  /(^|\/)(__tests__|__mocks__)\//.test(file) ||
  /\.(test|spec)\.tsx?$/.test(file);

type Helpers = Map<string, ts.FunctionLikeDeclaration>;

interface Bindings {
  /** local name -> wrapper name */
  wrappers: Map<string, string>;
  /** namespace aliases of a wrapper module */
  namespaces: Set<string>;
  /** default-import aliases of apps/tlon-web/src/api.ts */
  webClients: Set<string>;
}

interface Ctx {
  file: string;
  sf: ts.SourceFile;
  helpers: Helpers;
  out: Dependency[];
}

/** A resolved value plus the branch it came from. */
interface Val<T> {
  value: T;
  guard?: string;
  block?: ts.Node | null;
}

function collectBindings(sf: ts.SourceFile): Bindings {
  const wrappers = new Map<string, string>();
  const namespaces = new Set<string>();
  const webClients = new Set<string>();
  for (const stmt of sf.statements) {
    if (!ts.isImportDeclaration(stmt) || !stmt.importClause) continue;
    if (!ts.isStringLiteral(stmt.moduleSpecifier)) continue;
    const spec = stmt.moduleSpecifier.text;
    const { name, namedBindings } = stmt.importClause;
    if (WRAPPER_SPECIFIERS.has(spec) && namedBindings) {
      if (ts.isNamedImports(namedBindings)) {
        for (const el of namedBindings.elements) {
          const imported = (el.propertyName ?? el.name).text;
          if (WRAPPERS.has(imported)) wrappers.set(el.name.text, imported);
        }
      } else namespaces.add(namedBindings.name.text);
    }
    if (WEB_CLIENT_SPECIFIERS.has(spec) && name) webClients.add(name.text);
  }
  return { wrappers, namespaces, webClients };
}

type Callee = { wrapper: string; positional: boolean } | 'airlock' | null;

/**
 * Does a scope between the call and the file declare this name?
 *
 * The import map is file-wide, so without this a parameter or local called
 * `poke` reads as the imported wrapper and invents a dependency the client
 * never has — which downstream is a `MISSING` nobody can fix.
 */
function shadowed(node: ts.Node, name: string): boolean {
  const declares = (n: ts.BindingName): boolean =>
    ts.isIdentifier(n)
      ? n.text === name
      : n.elements.some((e) => !ts.isOmittedExpression(e) && declares(e.name));
  for (let cur: ts.Node | undefined = node; cur; cur = cur.parent) {
    if (ts.isFunctionLike(cur) && cur.parameters.some((p) => declares(p.name)))
      return true;
    if (
      (ts.isFunctionDeclaration(cur) || ts.isClassDeclaration(cur)) &&
      cur.name?.text === name
    ) {
      return true;
    }
    if (ts.isCatchClause(cur) && cur.variableDeclaration) {
      if (declares(cur.variableDeclaration.name)) return true;
    }
    const body = ts.isBlock(cur)
      ? cur.statements
      : ts.isSourceFile(cur)
        ? []
        : null;
    if (body) {
      for (const stmt of body) {
        if (
          ts.isVariableStatement(stmt) &&
          stmt.declarationList.declarations.some((d) => declares(d.name))
        ) {
          return true;
        }
        if (ts.isFunctionDeclaration(stmt) && stmt.name?.text === name)
          return true;
      }
    }
  }
  return false;
}

function resolveCallee(node: ts.CallExpression, b: Bindings): Callee {
  const callee = node.expression;
  if (ts.isIdentifier(callee)) {
    const wrapper = b.wrappers.get(callee.text);
    if (!wrapper || shadowed(node, callee.text)) return null;
    return { wrapper, positional: false };
  }
  if (
    !ts.isPropertyAccessExpression(callee) ||
    !ts.isIdentifier(callee.expression)
  ) {
    return null;
  }
  const obj = callee.expression.text;
  const prop = callee.name.text;
  if (obj === 'airlock' && prop === 'subscribe') return 'airlock';
  if (shadowed(node, obj)) return null;
  if (!WRAPPERS.has(prop)) return null;
  if (b.namespaces.has(obj)) return { wrapper: prop, positional: false };
  // The web client's `subscribeOnce(app, path, timeout)` is positional — a
  // distinct arity rule from the @tloncorp/api wrapper of the same name.
  if (b.webClients.has(obj))
    return { wrapper: prop, positional: prop === 'subscribeOnce' };
  return null;
}

const lineOf = (ctx: Ctx, node: ts.Node) =>
  ctx.sf.getLineAndCharacterOfPosition(node.getStart(ctx.sf)).line + 1;
// Against the node's *own* file, not the file being scanned: a whitelisted
// helper is often defined in another module, and slicing its node out of the
// caller's text yields whatever happens to sit at those offsets.
const textOf = (_ctx: Ctx, node: ts.Node) =>
  node.getText(node.getSourceFile()).replace(/\s+/g, ' ').slice(0, 200);

function makeKey(d: Omit<Dependency, 'key' | 'site' | 'text'>): string {
  if (d.surface === 'poke') return `poke ${d.app ?? '?'} ${d.mark ?? '?'}`;
  if (d.surface === 'thread')
    return `thread ${d.app ?? '?'}/${d.thread ?? '?'} ${d.mark ?? '?'}`;
  if (d.surface === 'http') return `http ${d.path?.text ?? '?'}`;
  if (d.path === null) return `${d.surface} ${d.app ?? '?'} ?`;
  if (d.path.shape) return `${d.surface} ${d.app ?? '?'} ${d.path.shape}`;
  const segments = [...d.path.known];
  if (d.path.unknownTail) segments.push('*');
  return `${d.surface} ${d.app ?? '?'} /${segments.join('/')}`;
}

function push(
  ctx: Ctx,
  node: ts.Node,
  fields: Partial<Omit<Dependency, 'key' | 'site' | 'text'>> & {
    surface: Surface;
  }
) {
  const base = {
    app: null,
    path: null,
    mark: null,
    thread: null,
    ...fields,
  } as Omit<Dependency, 'key' | 'site' | 'text'>;
  ctx.out.push({
    ...base,
    key: makeKey(base),
    site: { file: ctx.file, line: lineOf(ctx, node) },
    text: textOf(ctx, node),
  });
}

// --- value resolution -------------------------------------------------------

/**
 * Literal path text. Braces are percent-escaped rather than doubled: a hole is
 * spelled `{}` or `{#hash}`, so `%7B` can never be produced by one, and the
 * literal `'/chan/{}'` cannot collide with `` `/chan/${x}` ``.
 */
const literalShape = (text: string) =>
  text.replace(/\{/g, '%7B').replace(/\}/g, '%7D');

/** `a`, `a.b.c` — no calls, no computed access, no parenthesised receiver. */
function isPlainChain(expr: ts.Expression): boolean {
  if (ts.isIdentifier(expr)) return true;
  return (
    ts.isPropertyAccessExpression(expr) &&
    !expr.questionDotToken &&
    isPlainChain(expr.expression)
  );
}

/**
 * The hole an interpolation leaves in a shape. A plain identifier chain is
 * anonymous; anything else is hashed over its *whole* text, so a suffix folded
 * into the expression cannot collapse onto the shorter shape and two long
 * expressions that differ late stay distinct.
 */
function hole(ctx: Ctx, expr: ts.Expression): string {
  if (isPlainChain(expr)) return '{}';
  const normalized = expr.getText(ctx.sf).replace(/\s+/g, ' ');
  return `{#${createHash('sha1').update(normalized).digest('hex').slice(0, 8)}}`;
}

/** Turn a resolved template head into path segments. */
export function segmentsFromLiteral(
  head: string,
  unknownTail: boolean
): string[] {
  const parts = head.split('/').filter(Boolean);
  // A final literal chunk glued to an interpolation is not a complete segment.
  if (unknownTail && !head.endsWith('/')) parts.pop();
  return parts;
}

function enclosingBlock(node: ts.Node): ts.Node | null {
  for (let cur = node.parent; cur; cur = cur.parent) {
    if (ts.isBlock(cur) || ts.isCaseClause(cur)) return cur;
  }
  return null;
}

function enclosingFunction(node: ts.Node): ts.Node | undefined {
  for (let cur = node.parent; cur; cur = cur.parent) {
    if (ts.isFunctionLike(cur)) return cur;
  }
  return undefined;
}

/**
 * Does this scope bind `name` itself — as a parameter, a variable, or a
 * declared function or class? Such a binding shadows anything an outer scope
 * calls `name`, so `localAssignments` must stop walking outward there even
 * when it found no assignment to read. A nested closure's own parameters are
 * its business, but a nested `function f` names `f` in *this* scope.
 */
function declaresName(scope: ts.Node, name: string): boolean {
  const isName = (n: ts.BindingName): boolean =>
    ts.isIdentifier(n)
      ? n.text === name
      : n.elements.some((e) => !ts.isOmittedExpression(e) && isName(e.name));
  let found = false;
  const visit = (node: ts.Node) => {
    if (found) return;
    if (node !== scope && ts.isFunctionLike(node)) {
      if (ts.isFunctionDeclaration(node) && node.name?.text === name)
        found = true;
      return;
    }
    if (
      ((ts.isParameter(node) || ts.isVariableDeclaration(node)) &&
        isName(node.name)) ||
      ((ts.isFunctionDeclaration(node) || ts.isClassDeclaration(node)) &&
        node.name?.text === name)
    ) {
      found = true;
      return;
    }
    ts.forEachChild(node, visit);
  };
  ts.forEachChild(scope, visit);
  return found;
}

/**
 * `scopeAssignments` continued outward through the lexical function scopes the
 * call is nested in, so `backOff(() => poke(action))` still reads the `action`
 * its enclosing function declared.
 *
 * Each scope keeps its own rules: assignments made inside a nested closure are
 * still excluded, and the reachable-before rule still applies — against the
 * nested function this scope encloses rather than against the call, since that
 * is the point in *this* scope's straight line from which the call is reached.
 * The walk stops at the innermost scope that binds the name, so a shadowing
 * parameter is never resolved to an outer variable of the same name.
 */
function localAssignments(
  ctx: Ctx,
  scope: ts.Node,
  name: string,
  /** Position of the call. Only assignments before it can reach it. */
  before?: number
): Val<ts.Expression>[] {
  let cur: ts.Node | undefined = scope;
  let pos = before;
  while (cur) {
    const found = scopeAssignments(ctx, cur, name, pos);
    // `null` is a write this reader could not read. Walking outward from it
    // would resolve to some other binding and report a value the call never
    // sends, so the walk stops with nothing.
    if (found === null) return [];
    if (found.length > 0 || declaresName(cur, name)) return found;
    pos = cur.getStart();
    cur = enclosingFunction(cur);
  }
  return [];
}

/**
 * Bounded local-variable resolution: one assignment chain, one hop, inside one
 * function body. Multi-branch assignment is *not* collapsed — each branch
 * becomes its own record, carrying the block it came from.
 */
function scopeAssignments(
  ctx: Ctx,
  scope: ts.Node,
  name: string,
  /** Position of the call. Only assignments before it can reach it. */
  before?: number
): Val<ts.Expression>[] | null {
  // A call inside a loop sees the previous iteration's value, so ordering says
  // nothing about which assignment reaches it.
  if (before !== undefined && inLoop(scope, before)) return [];
  const out: Val<ts.Expression>[] = [];
  // `path ||= '/v1'`, `path += id`: a write whose result depends on what the
  // variable already held. Reading only the `=` writes would report the
  // initialiser as the value the call sends, which it is not.
  let unreadableWrite = false;
  const visit = (node: ts.Node) => {
    // A nested closure's assignments run on its own schedule, not this one's.
    if (node !== scope && ts.isFunctionLike(node)) return;
    const value =
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === name &&
      node.initializer &&
      node.initializer.kind !== ts.SyntaxKind.NullKeyword
        ? node.initializer
        : ts.isBinaryExpression(node) &&
            node.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
            ts.isIdentifier(node.left) &&
            node.left.text === name
          ? node.right
          : null;
    // A *declaration* in a block the call is not inside is a different
    // variable of the same name, and never reaches the call:
    // `if (flag) { const path = … }` beside the call declares its own `path`.
    // An *assignment* in such a block writes the binding the call does read,
    // so it still counts — which is how `let scryPath` written in both arms of
    // an if/else is resolved.
    const block = enclosingBlock(node);
    const shadows =
      ts.isVariableDeclaration(node) &&
      before !== undefined &&
      block !== null &&
      !(block.getStart() <= before && before < block.getEnd());
    if (
      value &&
      !shadows &&
      (before === undefined || node.getStart() < before)
    ) {
      out.push({ value, block, guard: branchGuard(ctx, node, scope) });
    }
    if (
      ts.isBinaryExpression(node) &&
      ts.isIdentifier(node.left) &&
      node.left.text === name &&
      node.operatorToken.kind !== ts.SyntaxKind.EqualsToken &&
      node.operatorToken.kind >= ts.SyntaxKind.FirstCompoundAssignment &&
      node.operatorToken.kind <= ts.SyntaxKind.LastCompoundAssignment &&
      (before === undefined || node.getStart() < before)
    ) {
      unreadableWrite = true;
    }
    ts.forEachChild(node, visit);
  };
  ts.forEachChild(scope, visit);
  if (unreadableWrite) return null;
  // `let scryPath = ''` is a placeholder only where something later is *sure*
  // to overwrite it: a write on the straight line, or an if/else that assigns
  // in both arms. Under a lone `if` the empty value still reaches the call,
  // and dropping it hides a request to the root path.
  const isEmptyLiteral = (v: Val<ts.Expression>) =>
    (ts.isStringLiteral(v.value) ||
      ts.isNoSubstitutionTemplateLiteral(v.value)) &&
    v.value.text === '';
  const writes = out.filter((v) => !isEmptyLiteral(v));
  const armOf = (v: Val<ts.Expression>) => {
    for (let cur = v.value as ts.Node; cur.parent; cur = cur.parent) {
      const parent = cur.parent;
      if (ts.isIfStatement(parent) && parent.elseStatement) {
        if (cur === parent.thenStatement)
          return { branch: parent, arm: 'then' };
        if (cur === parent.elseStatement)
          return { branch: parent, arm: 'else' };
      }
    }
    return null;
  };
  const certainlyOverwrites = (empty: Val<ts.Expression>) =>
    writes.some((w) => {
      if (
        w.block != null &&
        w.block === empty.block &&
        runsUnconditionally(w.value, w.block)
      ) {
        return true;
      }
      // Both arms of one if/else, and that if/else itself on the straight line.
      const mine = armOf(w);
      if (!mine) return false;
      const other = writes.find((x) => {
        const theirs = armOf(x);
        return theirs?.branch === mine.branch && theirs.arm !== mine.arm;
      });
      return (
        other !== undefined &&
        empty.block != null &&
        runsUnconditionally(mine.branch, empty.block)
      );
    });
  const kept =
    writes.length > 0
      ? [
          ...writes,
          ...out.filter((v) => isEmptyLiteral(v) && !certainlyOverwrites(v)),
        ]
      : out;
  // On a straight line the last write is the only one the call can read.
  // Anything that makes reachability a question — a branch, a loop, a
  // short-circuit, a `case` — keeps every candidate, since the reader cannot
  // tell which one ran.
  const block = kept[0]?.block ?? null;
  if (
    kept.length > 1 &&
    block !== null &&
    kept.every((v) => v.block === block && runsUnconditionally(v.value, block))
  ) {
    return [kept[kept.length - 1]];
  }
  return kept;
}

/**
 * The conditions that had to hold for this node to run, outermost first.
 *
 * An assignment in an `if` arm is no less conditional than a ternary branch,
 * and reporting `if (supportsNew) params = modern; else params = legacy` as
 * two unguarded requests loses exactly the distinction the GUARDED rule reads.
 */
function branchGuard(
  ctx: Ctx,
  node: ts.Node,
  scope: ts.Node
): string | undefined {
  const parts: string[] = [];
  for (let cur = node; cur && cur !== scope; cur = cur.parent) {
    const parent: ts.Node | undefined = cur.parent;
    if (!parent) break;
    if (ts.isIfStatement(parent)) {
      const condition = textOf(ctx, parent.expression);
      if (cur === parent.thenStatement) parts.unshift(`${condition} ? …`);
      else if (cur === parent.elseStatement) parts.unshift(`! (${condition})`);
    } else if (ts.isCaseClause(cur) && ts.isCaseBlock(parent)) {
      const subject = ts.isSwitchStatement(parent.parent)
        ? textOf(ctx, parent.parent.expression)
        : '?';
      parts.unshift(`${subject} === ${textOf(ctx, cur.expression)}`);
    }
  }
  return parts.length > 0 ? parts.join(' && ') : undefined;
}

/** Does this assignment run every time control reaches its block? */
function runsUnconditionally(node: ts.Node, block: ts.Node): boolean {
  const SHORT_CIRCUIT = new Set([
    ts.SyntaxKind.AmpersandAmpersandToken,
    ts.SyntaxKind.BarBarToken,
    ts.SyntaxKind.QuestionQuestionToken,
  ]);
  for (let cur = node.parent; cur && cur !== block; cur = cur.parent) {
    if (
      ts.isConditionalExpression(cur) ||
      ts.isIfStatement(cur) ||
      ts.isSwitchStatement(cur) ||
      ts.isTryStatement(cur) ||
      ts.isIterationStatement(cur, false) ||
      (ts.isBinaryExpression(cur) && SHORT_CIRCUIT.has(cur.operatorToken.kind))
    ) {
      return false;
    }
  }
  return true;
}

/** Is the position inside a loop that the scope encloses? */
function inLoop(scope: ts.Node, pos: number): boolean {
  let found = false;
  const visit = (node: ts.Node) => {
    if (found) return;
    if (
      (ts.isForStatement(node) ||
        ts.isForInStatement(node) ||
        ts.isForOfStatement(node) ||
        ts.isWhileStatement(node) ||
        ts.isDoStatement(node)) &&
      node.getStart() <= pos &&
      pos < node.getEnd()
    ) {
      found = true;
      return;
    }
    ts.forEachChild(node, visit);
  };
  ts.forEachChild(scope, visit);
  return found;
}

/** The initialiser of an object property, or 'shorthand' for `{ path }`. */
function property(
  obj: ts.ObjectLiteralExpression,
  name: string
): ts.Expression | 'shorthand' | null {
  for (const prop of obj.properties) {
    const key =
      ts.isIdentifier(prop.name ?? prop) ||
      ts.isStringLiteral(prop.name ?? prop)
        ? (prop.name as ts.Identifier | ts.StringLiteral).text
        : null;
    if (key !== name) continue;
    if (ts.isPropertyAssignment(prop)) return prop.initializer;
    if (ts.isShorthandPropertyAssignment(prop)) return 'shorthand';
  }
  return null;
}

const stringLiteralOf = (expr: ts.Expression) =>
  ts.isStringLiteral(expr) || ts.isNoSubstitutionTemplateLiteral(expr)
    ? expr.text
    : null;

/** Both guards had to hold for the record to be sent. */
const bothGuards = (a?: string, b?: string) =>
  [a, b].filter(Boolean).join(' && ') || undefined;

/** Branch a conditional into its two arms, each carrying the guard text. */
function branches<T>(
  ctx: Ctx,
  expr: ts.ConditionalExpression,
  resolve: (e: ts.Expression) => Val<T>[]
): Val<T>[] {
  const guard = textOf(ctx, expr.condition);
  // Conjoined, never overwritten: in `a ? b ? x : y : z` the value `x` is sent
  // under `a && b`, and a guard that said only `a` would pair `x` with the
  // wrong sibling.
  return [
    ...resolve(expr.whenTrue).map((v) => ({
      ...v,
      guard: bothGuards(`${guard} ? …`, v.guard),
    })),
    ...resolve(expr.whenFalse).map((v) => ({
      ...v,
      guard: bothGuards(`! (${guard})`, v.guard),
    })),
  ];
}

/** Every string-literal value a property can take (`app`, `mark`). */
function literalValues(
  ctx: Ctx,
  obj: ts.ObjectLiteralExpression,
  name: string,
  scope: ts.Node | undefined,
  callPos?: number
): Val<string | null>[] {
  const resolve = (expr: ts.Expression): Val<string | null>[] => {
    if (ts.isConditionalExpression(expr)) return branches(ctx, expr, resolve);
    return [{ value: stringLiteralOf(expr) }];
  };
  const prop = property(obj, name);
  if (prop === null) return [{ value: null }];
  const local = (identifier: string) =>
    scope ? localAssignments(ctx, scope, identifier, callPos) : [];
  const assignments =
    prop === 'shorthand'
      ? local(name)
      : ts.isIdentifier(prop)
        ? local(prop.text)
        : [];
  if (assignments.length > 0) {
    return assignments.flatMap((a) =>
      resolve(a.value).map((v) => ({
        ...v,
        block: a.block,
        guard: bothGuards(a.guard, v.guard),
      }))
    );
  }
  return prop === 'shorthand' ? [{ value: null }] : resolve(prop);
}

/** Every path a property can take, resolved down to its literal prefix. */
function pathValues(
  ctx: Ctx,
  expr: ts.Expression,
  scope: ts.Node | undefined,
  callPos?: number,
  depth = 0
): Val<PathPattern>[] {
  const text = textOf(ctx, expr);
  if (ts.isStringLiteral(expr) || ts.isNoSubstitutionTemplateLiteral(expr)) {
    return [
      {
        value: {
          known: segmentsFromLiteral(expr.text, false),
          unknownTail: false,
          text,
          shape: literalShape(expr.text),
        },
      },
    ];
  }
  if (ts.isTemplateExpression(expr)) {
    const unknownTail = expr.templateSpans.length > 0;
    return [
      {
        value: {
          known: segmentsFromLiteral(expr.head.text, unknownTail),
          unknownTail,
          text,
          // Literal text after each interpolation is still identity, even
          // though matching stops at the first unknown.
          shape:
            literalShape(expr.head.text) +
            expr.templateSpans
              .map(
                (s) => hole(ctx, s.expression) + literalShape(s.literal.text)
              )
              .join(''),
        },
      },
    ];
  }
  if (ts.isConditionalExpression(expr)) {
    return branches(ctx, expr, (e) =>
      pathValues(ctx, e, scope, callPos, depth)
    );
  }
  if (ts.isIdentifier(expr) && depth === 0 && scope) {
    const assignments = localAssignments(ctx, scope, expr.text, callPos);
    if (assignments.length > 0) {
      return assignments.flatMap((a) =>
        pathValues(ctx, a.value, scope, callPos, depth + 1).map((v) => ({
          ...v,
          block: a.block,
          guard: bothGuards(a.guard, v.guard),
        }))
      );
    }
  }
  return [{ value: { known: [], unknownTail: true, text } }];
}

/**
 * Pair an `app` value with a `path` or `mark` value, one pair per request the
 * code can actually make.
 *
 * Two ways they can be one choice rather than two. `getPostWithReplies`
 * assigns `app` and `path` in three `if/else` arms, so the block they sit in
 * pairs them; `{ app: dm ? 'chat' : 'channels', path: dm ? …  : … }` branches
 * twice on the *same condition*, so the guard text does. Either way the cross
 * product would invent a request no code path makes.
 *
 * Independent conditions do cross-multiply, because each combination is
 * reachable, and the pair carries both guards conjoined.
 */
function pairValues<A, B>(
  as: Val<A>[],
  bs: Val<B>[]
): { a: Val<A>; b: Val<B>; guard?: string }[] {
  const positional = (paired: { a: Val<A>; b: Val<B> }[]) =>
    paired.map((p) => ({
      ...p,
      guard:
        p.a.guard === p.b.guard ? p.a.guard : bothGuards(p.a.guard, p.b.guard),
    }));

  if (as.length > 1 && bs.length > 1) {
    if (as.every((v) => v.block) && bs.every((v) => v.block)) {
      const paired = bs.map((b) => ({
        a: as.find((a) => a.block === b.block),
        b,
      }));
      if (paired.every((p) => p.a))
        return positional(paired as { a: Val<A>; b: Val<B> }[]);
    }
    if (
      as.length === bs.length &&
      as.every((a, i) => a.guard !== undefined && a.guard === bs[i].guard)
    ) {
      return positional(as.map((a, i) => ({ a, b: bs[i] })));
    }
  }
  return as.flatMap((a) =>
    bs.map((b) => ({ a, b, guard: bothGuards(a.guard, b.guard) }))
  );
}

// --- helper expansion -------------------------------------------------------

const HELPER_HINT = new RegExp(
  [...HELPER_WHITELIST].map((h) => `\\b${h}\\b`).join('|')
);

function indexHelpers(sf: ts.SourceFile, into: Helpers) {
  const visit = (node: ts.Node) => {
    if (
      ts.isFunctionDeclaration(node) &&
      node.name &&
      HELPER_WHITELIST.has(node.name.text)
    ) {
      into.set(node.name.text, node);
    } else if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      HELPER_WHITELIST.has(node.name.text) &&
      node.initializer &&
      ts.isFunctionLike(node.initializer)
    ) {
      into.set(node.name.text, node.initializer);
    }
    ts.forEachChild(node, visit);
  };
  ts.forEachChild(sf, visit);
}

const calleeName = (expr: ts.CallExpression) =>
  ts.isIdentifier(expr.expression)
    ? expr.expression.text
    : ts.isPropertyAccessExpression(expr.expression)
      ? expr.expression.name.text
      : null;

interface PokeParams {
  app: string | null;
  mark: string | null;
  guard?: string;
  unresolved?: string;
}

/**
 * Every `{app, mark}` pair a whitelisted helper can return, one per return
 * statement so guarded branches stay separate. One hop of forwarding is
 * followed, which recovers `channelPostAction` → `channelAction`.
 */
function expandHelper(ctx: Ctx, name: string, depth = 0): PokeParams[] {
  const body = ctx.helpers.get(name)?.body;
  if (!body)
    return [{ app: null, mark: null, unresolved: `helper ${name} not found` }];

  /**
   * Each return with the condition it sits under. An early `return` inside an
   * `if` implicitly negates that condition for everything after it, which is
   * exactly how `activityAction` gates `activity-action-2`; without the
   * condition every call site would look like it needs all three marks, and
   * the documented fallback could never pass the gate.
   */
  const returns: [ts.Expression, string | undefined][] = [];
  const statementsOf = (s: ts.Statement): readonly ts.Statement[] =>
    ts.isBlock(s) ? s.statements : [s];
  const alwaysReturns = (s: ts.Statement): boolean => {
    const list = statementsOf(s);
    const last = list[list.length - 1];
    return Boolean(
      last && (ts.isReturnStatement(last) || ts.isThrowStatement(last))
    );
  };
  const nested = (node: ts.Node, guard?: string) => {
    if (ts.isFunctionLike(node)) return;
    if (ts.isReturnStatement(node) && node.expression) {
      returns.push([node.expression, guard]);
    }
    ts.forEachChild(node, (n) => nested(n, guard));
  };
  const walkStatements = (list: readonly ts.Statement[], guard?: string) => {
    let acc = guard;
    for (const stmt of list) {
      if (ts.isReturnStatement(stmt)) {
        if (stmt.expression) returns.push([stmt.expression, acc]);
        continue;
      }
      if (ts.isIfStatement(stmt)) {
        const cond = textOf(ctx, stmt.expression);
        walkStatements(statementsOf(stmt.thenStatement), bothGuards(acc, cond));
        if (stmt.elseStatement) {
          walkStatements(
            statementsOf(stmt.elseStatement),
            bothGuards(acc, `! (${cond})`)
          );
        } else if (alwaysReturns(stmt.thenStatement)) {
          acc = bothGuards(acc, `! (${cond})`);
        }
        continue;
      }
      nested(stmt, acc);
    }
  };
  if (ts.isBlock(body)) walkStatements(body.statements);
  else returns.push([body as ts.Expression, undefined]);

  const results: PokeParams[] = [];
  const unresolved = (why: string) =>
    results.push({ app: null, mark: null, unresolved: why });
  const fromObject = (obj: ts.ObjectLiteralExpression, guard?: string) => {
    for (const pair of pairValues(
      literalValues(ctx, obj, 'app', undefined),
      literalValues(ctx, obj, 'mark', undefined)
    )) {
      results.push({
        app: pair.a.value,
        mark: pair.b.value,
        guard: bothGuards(guard, pair.guard),
      });
    }
  };

  const read = (expr: ts.Expression, hop: number, guard?: string) => {
    if (ts.isObjectLiteralExpression(expr)) return fromObject(expr, guard);
    const forwarded = ts.isCallExpression(expr) ? calleeName(expr) : null;
    if (forwarded && hop < 2 && HELPER_WHITELIST.has(forwarded)) {
      return results.push(
        ...expandHelper(ctx, forwarded, hop + 1).map((r) => ({
          ...r,
          guard: bothGuards(guard, r.guard),
        }))
      );
    }
    // `const action: Poke<...> = {...}; return action;`
    const local = ts.isIdentifier(expr)
      ? localAssignments(ctx, body, expr.text, expr.getStart(ctx.sf))
      : [];
    if (local.length > 0)
      return local.forEach((a) =>
        read(a.value, hop, bothGuards(guard, a.guard))
      );
    unresolved(`helper ${name} returns ${textOf(ctx, expr)}`);
  };
  returns.forEach(([expr, guard]) => read(expr, depth, guard));

  if (results.length === 0)
    unresolved(`helper ${name} has no resolvable return`);
  return results;
}

// --- argument readers -------------------------------------------------------

function readEndpoint(
  ctx: Ctx,
  node: ts.Node,
  arg: ts.Expression | undefined,
  surface: 'scry' | 'subscribe'
) {
  const scope = enclosingFunction(node);
  const pos = node.getStart(ctx.sf);
  if (!arg) return push(ctx, node, { surface, unresolved: 'missing argument' });
  if (ts.isObjectLiteralExpression(arg)) {
    return readEndpointObject(ctx, node, arg, surface, scope, pos);
  }
  const assignments =
    ts.isIdentifier(arg) && scope
      ? localAssignments(ctx, scope, arg.text, node.getStart(ctx.sf))
      : [];
  if (assignments.length === 0) {
    return push(ctx, node, {
      surface,
      unresolved: `endpoint argument is ${textOf(ctx, arg)}`,
    });
  }
  // An assignment this reader cannot read is still a branch that reaches the
  // ship, so it is recorded as coverage rather than silently dropped.
  for (const a of assignments) {
    if (ts.isObjectLiteralExpression(a.value)) {
      readEndpointObject(ctx, node, a.value, surface, scope, pos);
    } else {
      push(ctx, node, {
        surface,
        guard: a.guard,
        unresolved: `endpoint comes from ${textOf(ctx, a.value)}`,
      });
    }
  }
}

function readEndpointObject(
  ctx: Ctx,
  node: ts.Node,
  obj: ts.ObjectLiteralExpression,
  surface: 'scry' | 'subscribe',
  scope: ts.Node | undefined,
  callPos: number
) {
  const prop = property(obj, 'path');
  const unknown = (text: string): Val<PathPattern>[] => [
    { value: { known: [], unknownTail: true, text } },
  ];
  let paths: Val<PathPattern>[];
  if (prop === null) paths = unknown('<no path>');
  else if (prop === 'shorthand') {
    const assignments = scope
      ? localAssignments(ctx, scope, 'path', callPos)
      : [];
    paths = assignments.length
      ? assignments.flatMap((a) =>
          pathValues(ctx, a.value, scope, callPos, 1).map((v) => ({
            ...v,
            block: a.block,
            guard: bothGuards(a.guard, v.guard),
          }))
        )
      : unknown('path (shorthand, unresolved)');
  } else paths = pathValues(ctx, prop, scope, callPos);

  for (const { a: app, b: path, guard } of pairValues(
    literalValues(ctx, obj, 'app', scope, callPos),
    paths
  )) {
    push(ctx, node, {
      surface,
      app: app.value,
      path: path.value,
      guard,
      unresolved:
        app.value === null
          ? 'app is not a string literal'
          : path.value.known.length === 0 && path.value.unknownTail
            ? `path could not be resolved: ${path.value.text}`
            : undefined,
    });
  }
}

function readPokeParams(
  ctx: Ctx,
  node: ts.Node,
  arg: ts.Expression | undefined,
  depth = 0,
  /** The branch condition that had to hold for this argument to be sent. */
  guard?: string
) {
  const scope = enclosingFunction(node);
  const pos = node.getStart(ctx.sf);
  const emit = (r: PokeParams) =>
    push(ctx, node, {
      surface: 'poke',
      app: r.app,
      mark: r.mark,
      guard: bothGuards(guard, r.guard),
      unresolved:
        r.unresolved ??
        (r.mark === null
          ? 'mark is not a string literal'
          : r.app === null
            ? 'app is not a string literal'
            : undefined),
    });
  const unresolved = (why: string) =>
    push(ctx, node, { surface: 'poke', guard, unresolved: why });
  if (!arg) return unresolved('missing argument');

  if (ts.isObjectLiteralExpression(arg)) {
    for (const { a, b, guard } of pairValues(
      literalValues(ctx, arg, 'app', scope, pos),
      literalValues(ctx, arg, 'mark', scope, pos)
    )) {
      emit({ app: a.value, mark: b.value, guard });
    }
    return;
  }
  if (ts.isCallExpression(arg)) {
    const name = calleeName(arg);
    if (name && HELPER_WHITELIST.has(name))
      return expandHelper(ctx, name).forEach(emit);
    return unresolved(`poke params come from ${name ?? 'a call'}(…)`);
  }
  // Each branch is its own record, carrying its own guard; never unioned. The
  // guard is what lets a capability fallback written as `a ? new : old` be
  // recognised as one, exactly as the `{ mark: a ? … : … }` spelling is.
  if (ts.isConditionalExpression(arg)) {
    const condition = textOf(ctx, arg.condition);
    const under = (text: string) => bothGuards(guard, text);
    readPokeParams(ctx, node, arg.whenTrue, depth, under(`${condition} ? …`));
    return readPokeParams(
      ctx,
      node,
      arg.whenFalse,
      depth,
      under(`! (${condition})`)
    );
  }
  // Bounded local-variable resolution: one hop.
  if (ts.isIdentifier(arg) && scope && depth === 0) {
    const assignments = localAssignments(
      ctx,
      scope,
      arg.text,
      node.getStart(ctx.sf)
    );
    if (assignments.length) {
      return assignments.forEach((a) =>
        readPokeParams(
          ctx,
          node,
          a.value,
          depth + 1,
          bothGuards(guard, a.guard)
        )
      );
    }
  }
  unresolved(`poke params are ${textOf(ctx, arg)}`);
}

function readCall(
  ctx: Ctx,
  node: ts.CallExpression,
  kind: { wrapper: string; positional: boolean }
) {
  const args = node.arguments;
  switch (kind.wrapper) {
    case 'scry':
    case 'scryNoun':
      return readEndpoint(ctx, node, args[0], 'scry');
    case 'subscribe':
      return readEndpoint(ctx, node, args[0], 'subscribe');
    case 'subscribeOnce':
      if (!kind.positional)
        return readEndpoint(ctx, node, args[0], 'subscribe');
      // apps/tlon-web/src/api.ts: subscribeOnce(app, path, timeout)
      for (const path of args[1]
        ? pathValues(
            ctx,
            args[1],
            enclosingFunction(node),
            node.getStart(ctx.sf)
          )
        : [{ value: { known: [], unknownTail: true, text: '<missing>' } }]) {
        const app = args[0] ? stringLiteralOf(args[0]) : null;
        push(ctx, node, {
          surface: 'subscribe',
          app,
          path: path.value,
          // The same check `readEndpointObject` makes: a path with no known
          // prefix is a request this reader could not read, not one it read
          // as the root.
          unresolved:
            app === null
              ? 'app is not a string literal'
              : path.value.known.length === 0 && path.value.unknownTail
                ? `path could not be resolved: ${path.value.text}`
                : undefined,
        });
      }
      return;
    case 'poke':
    case 'pokeNoun':
      return readPokeParams(ctx, node, args[0]);
    case 'trackedPoke':
    case 'trackedPokeNoun':
      // Both arguments are dependencies: a mark in arg 0 and a watch endpoint
      // in arg 1.
      readPokeParams(ctx, node, args[0]);
      return readEndpoint(ctx, node, args[1], 'subscribe');
    case 'thread': {
      // A thread is identified by the desk that runs it, its name, and the
      // mark it takes: two desks may both ship a `group-create-1`, and a
      // thread that starts taking a different input mark is a new dependency.
      const obj =
        args[0] && ts.isObjectLiteralExpression(args[0]) ? args[0] : null;
      const literal = (name: string) => {
        const prop = obj ? property(obj, name) : null;
        return prop && prop !== 'shorthand' ? stringLiteralOf(prop) : null;
      };
      const desk = literal('desk');
      const name = literal('threadName');
      const inputMark = literal('inputMark');
      const missing = (['desk', 'threadName', 'inputMark'] as const).filter(
        (k) => literal(k) === null
      );
      return push(ctx, node, {
        surface: 'thread',
        app: desk,
        mark: inputMark,
        thread: name,
        unresolved:
          missing.length > 0
            ? `${missing.join(', ')} ${missing.length > 1 ? 'are' : 'is'} not a string literal`
            : undefined,
      });
    }
    case 'requestJson':
    case 'request':
      // Raw eyre URLs are not a matcher target; recorded so layer 2 reviews
      // them rather than the report silently dropping them.
      return push(ctx, node, {
        surface: 'http',
        path: {
          known: [],
          unknownTail: true,
          text: args[0] ? textOf(ctx, args[0]) : '<missing>',
        },
        unresolved: 'raw eyre URL — outside layer 1, reviewed by layer 2',
      });
  }
}

const parse = (file: string, source: string) =>
  ts.createSourceFile(
    file,
    source,
    ts.ScriptTarget.Latest,
    /* setParentNodes */ true,
    file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  );

export function extractFile(
  file: string,
  source: string,
  out: Dependency[],
  sharedHelpers?: Helpers
): void {
  const sf = parse(file, source);
  const bindings = collectBindings(sf);
  const helpers: Helpers = new Map(sharedHelpers);
  indexHelpers(sf, helpers);
  const ctx: Ctx = { file, sf, helpers, out };
  const visit = (node: ts.Node) => {
    if (ts.isCallExpression(node)) {
      const kind = resolveCallee(node, bindings);
      if (kind === 'airlock') {
        push(ctx, node, {
          surface: 'subscribe',
          unresolved:
            'airlock.subscribe on a supplied client; app and path come from a factory callback',
        });
      } else if (kind) readCall(ctx, node, kind);
    }
    ts.forEachChild(node, visit);
  };
  ts.forEachChild(sf, visit);
}

/**
 * Whole-tree extraction. Syntax-only: no `createProgram`, no type checker, no
 * module resolution, so it runs over a bare `git archive` tree with no
 * `node_modules`.
 */
export function extractClient(
  tree: Tree,
  roots: string[] = CLIENT_ROOTS
): Dependency[] {
  const files: { file: string; source: string }[] = [];
  for (const root of roots) {
    for (const file of tree.list(
      root,
      (p) => /\.tsx?$/.test(p) && !p.endsWith('.d.ts')
    )) {
      const source = isSkipped(file) ? null : tree.readFile(file);
      if (source !== null) files.push({ file, source });
    }
  }
  // Helpers are defined in a handful of modules but called from many, so index
  // them across the tree before extracting.
  const shared: Helpers = new Map();
  for (const { file, source } of files) {
    if (HELPER_HINT.test(source)) indexHelpers(parse(file, source), shared);
  }
  const out: Dependency[] = [];
  for (const { file, source } of files) extractFile(file, source, out, shared);
  return out;
}

import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import ts from 'typescript';

/**
 * The convention check behind D72: in the surface sources, JSON values are
 * compared through `canonicalJson` and nothing else.
 *
 * D72 is a rule about a *pair* of values — "any comparison of a written spec
 * against a read-back one must use the raw cell" — and rules about pairs are
 * exactly the ones a codebase forgets, because each individual site looks
 * reasonable. The publish gate's two comparison sites carry long comments
 * explaining why they read `read.raw` instead of `read.spec`; those comments
 * protect those two lines and nothing else. This file is the part that
 * generalises: it fails the build when a *new* site is written in the shape the
 * comments warn about, so the audit is a one-time migration rather than a
 * recurring memory exercise.
 *
 * Three shapes are refused:
 *
 * - `JSON.stringify(a) === JSON.stringify(b)` — deep equality by serialization.
 *   Key order is not content, so this reports differences that are not there;
 *   it is also the shape that quietly survives a `canonicalJson` migration
 *   because it never mentions the helper.
 * - a call to a deep-equality function (`isEqual`, `deepEqual`,
 *   `deepStrictEqual`, `dequal`, …), or an import that brings one in. A
 *   structural comparator applied to a validated spec compares a
 *   schema-stripped view; applied to a raw cell it duplicates the helper.
 * - a second definition of the canonical helper. The convention is worth
 *   nothing while there are several helpers to be canonical: before this check
 *   existed the repo held three `canonicalJson`s that disagreed about
 *   `undefined`, and the divergent one was in the gate.
 *
 * There is deliberately **no suppression comment**. An escape hatch on a
 * convention check is the thing people reach for instead of the convention, and
 * the convention here is one function call. If a comparison genuinely needs
 * different semantics, it needs a different named helper in the canonical
 * module — reviewed once — not an opt-out at the call site.
 *
 * **Scope is the surface sources of this package only.** `packages/api`'s
 * `deepEqualJson` compares `channelContentConfiguration`, a different domain
 * with no schema-stripping hazard, and `packages/app`'s `stableStringify`
 * compares bot-settings drafts. Sweeping either in would be a false positive,
 * and a check that cries wolf teaches people to silence it — which costs more
 * than the coverage gained.
 *
 * **What this check does NOT see** (an honest boundary, not an oversight):
 * hand-rolled key-by-key comparison loops; `===` between two values that both
 * happen to be spec-typed (it has no type checker, only the syntax tree);
 * a comparison written against a spec *field* where a whole-spec comparison was
 * meant; comparisons inside `*.test.ts` files, which are out of scope on
 * purpose because a test asserting an exact serialization is legitimate; and
 * anything outside this package. Those shapes were swept by hand at migration
 * time and are recorded in the session report.
 */

/** Relative to this package root. The one module allowed to define the helper. */
export const CANONICAL_HELPER_FILE = 'scripts/surface-canonical-json.ts';

/** The exported name every surface JSON comparison goes through. */
export const CANONICAL_HELPER_NAME = 'canonicalJson';

/**
 * Names that mean "structural equality". Members as well as bare identifiers,
 * so `_.isEqual(a, b)` and `assert.deepStrictEqual(a, b)` are caught along with
 * an import of the bare function.
 */
const DEEP_EQUALITY_NAMES = new Set([
  'deepEqual',
  'deepEquals',
  'deepEqualJson',
  'deepStrictEqual',
  'notDeepEqual',
  'notDeepStrictEqual',
  'isDeepStrictEqual',
  'isEqual',
  'isEqualWith',
  'dequal',
  'dequalLite',
  'fastDeepEqual',
  'shallowEqual',
  'jsonEqual',
]);

/** Modules whose whole purpose is structural equality. */
const DEEP_EQUALITY_MODULES = new Set([
  'dequal',
  'dequal/lite',
  'fast-deep-equal',
  'fast-deep-equal/es6',
  'deep-equal',
  'lodash.isequal',
  'lodash/isEqual',
  'lodash/isEqual.js',
]);

/**
 * Names a second canonical-serialization helper would plausibly take. Matching
 * on name rather than on shape is the point: the failure this prevents is
 * someone writing their own sorted-key stringifier because they did not know
 * this one existed, and they will not invent a name far from these.
 */
const CANONICAL_ALIASES = new Set([
  'canonicalJson',
  'canonicalJSON',
  'canonicaliseJson',
  'canonicalizeJson',
  'stableStringify',
  'stableJson',
  'stableJsonStringify',
  'sortedJson',
  'jsonKey',
]);

export type ComparisonRule =
  | 'serialized-comparison'
  | 'ad-hoc-deep-equality'
  | 'duplicate-canonical-helper';

export interface ComparisonViolation {
  /** Package-relative, POSIX separators, so the message is stable across hosts. */
  file: string;
  line: number;
  column: number;
  rule: ComparisonRule;
  message: string;
  /** The offending source line, trimmed — enough to recognise without opening it. */
  snippet: string;
}

function unwrap(node: ts.Expression): ts.Expression {
  if (
    ts.isParenthesizedExpression(node) ||
    ts.isAsExpression(node) ||
    ts.isSatisfiesExpression(node) ||
    ts.isNonNullExpression(node) ||
    ts.isTypeAssertionExpression(node)
  ) {
    return unwrap(node.expression);
  }
  return node;
}

function calleeName(node: ts.CallExpression): string | null {
  const callee = unwrap(node.expression);
  if (ts.isIdentifier(callee)) {
    return callee.text;
  }
  if (ts.isPropertyAccessExpression(callee) && ts.isIdentifier(callee.name)) {
    return callee.name.text;
  }
  return null;
}

function isJsonStringifyCall(node: ts.Expression): boolean {
  const expression = unwrap(node);
  if (!ts.isCallExpression(expression)) {
    return false;
  }
  const callee = unwrap(expression.expression);
  return (
    ts.isPropertyAccessExpression(callee) &&
    ts.isIdentifier(callee.expression) &&
    callee.expression.text === 'JSON' &&
    ts.isIdentifier(callee.name) &&
    callee.name.text === 'stringify'
  );
}

const EQUALITY_OPERATORS = new Set<ts.SyntaxKind>([
  ts.SyntaxKind.EqualsEqualsEqualsToken,
  ts.SyntaxKind.ExclamationEqualsEqualsToken,
  ts.SyntaxKind.EqualsEqualsToken,
  ts.SyntaxKind.ExclamationEqualsToken,
]);

/** The name a declaration binds, for the declarations that can hold a function. */
function declaredName(node: ts.Node): ts.Identifier | null {
  if (
    (ts.isFunctionDeclaration(node) ||
      ts.isMethodDeclaration(node) ||
      ts.isVariableDeclaration(node) ||
      ts.isPropertyAssignment(node) ||
      ts.isPropertyDeclaration(node)) &&
    node.name !== undefined &&
    ts.isIdentifier(node.name)
  ) {
    return node.name;
  }
  return null;
}

/**
 * Scans one file's source text. `file` is the package-relative path used in
 * messages and in the canonical-module exemption, so callers must pass the same
 * form `surfaceSourceFiles` returns.
 */
export function scanSourceForComparisonViolations(
  source: string,
  file: string
): ComparisonViolation[] {
  const sourceFile = ts.createSourceFile(
    file,
    source,
    ts.ScriptTarget.Latest,
    /* setParentNodes */ true,
    ts.ScriptKind.TS
  );
  const lines = source.split('\n');
  const violations: ComparisonViolation[] = [];
  const isCanonicalModule = file === CANONICAL_HELPER_FILE;

  const report = (
    node: ts.Node,
    rule: ComparisonRule,
    message: string
  ): void => {
    const { line, character } = sourceFile.getLineAndCharacterOfPosition(
      node.getStart(sourceFile)
    );
    violations.push({
      file,
      line: line + 1,
      column: character + 1,
      rule,
      message,
      snippet: (lines[line] ?? '').trim(),
    });
  };

  const visit = (node: ts.Node): void => {
    if (
      ts.isBinaryExpression(node) &&
      EQUALITY_OPERATORS.has(node.operatorToken.kind) &&
      (isJsonStringifyCall(node.left) || isJsonStringifyCall(node.right))
    ) {
      report(
        node,
        'serialized-comparison',
        `comparing JSON.stringify output is deep equality by another name, and it is key-order sensitive; use ${CANONICAL_HELPER_NAME}() from ${CANONICAL_HELPER_FILE} on both sides (D72)`
      );
    }

    if (ts.isCallExpression(node)) {
      const name = calleeName(node);
      if (name !== null && DEEP_EQUALITY_NAMES.has(name)) {
        report(
          node,
          'ad-hoc-deep-equality',
          `"${name}" is an ad-hoc structural comparison; surface JSON is compared through ${CANONICAL_HELPER_NAME}() from ${CANONICAL_HELPER_FILE}, on raw cells, never on schema-validated views (D72)`
        );
      }
    }

    if (
      ts.isImportDeclaration(node) &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      const specifier = node.moduleSpecifier.text;
      const clause = node.importClause;
      const bringsEqualityName =
        clause?.namedBindings !== undefined &&
        ts.isNamedImports(clause.namedBindings) &&
        clause.namedBindings.elements.some((element) =>
          DEEP_EQUALITY_NAMES.has((element.propertyName ?? element.name).text)
        );
      if (DEEP_EQUALITY_MODULES.has(specifier) || bringsEqualityName) {
        report(
          node,
          'ad-hoc-deep-equality',
          `importing a structural-equality helper from "${specifier}"; surface JSON is compared through ${CANONICAL_HELPER_NAME}() from ${CANONICAL_HELPER_FILE} (D72)`
        );
      }
    }

    if (!isCanonicalModule) {
      const name = declaredName(node);
      if (name !== null && CANONICAL_ALIASES.has(name.text)) {
        report(
          name,
          'duplicate-canonical-helper',
          `"${name.text}" redefines the canonical comparison helper; there is exactly one, exported from ${CANONICAL_HELPER_FILE}, and copies of it have already diverged once (D72)`
        );
      }
    }

    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
  return violations;
}

/** This package's root, derived from this file's own location. */
export function packageRoot(): string {
  return resolve(__dirname, '..');
}

/**
 * Every surface source in the package, package-relative with POSIX separators.
 *
 * Discovery is by naming convention (`scripts/**\/surface*.ts`) rather than an
 * explicit list, so a surface source added tomorrow is covered without anyone
 * remembering to enrol it — which is the failure mode that produced the lost
 * 17-site audit this check replaces. Test files are excluded: a test asserting
 * an exact serialization is legitimate.
 */
export function surfaceSourceFiles(root: string = packageRoot()): string[] {
  const found: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
        continue;
      }
      if (!entry.name.endsWith('.ts')) continue;
      if (entry.name.endsWith('.test.ts') || entry.name.endsWith('.spec.ts')) {
        continue;
      }
      if (!/^surface/.test(entry.name)) continue;
      found.push(relative(root, full).split(sep).join('/'));
    }
  };
  walk(join(root, 'scripts'));
  return found.sort();
}

/** Runs the convention over every surface source and returns what it found. */
export function checkComparisonConvention(
  root: string = packageRoot()
): ComparisonViolation[] {
  return surfaceSourceFiles(root).flatMap((file) =>
    scanSourceForComparisonViolations(
      readFileSync(join(root, file), 'utf8'),
      file
    )
  );
}

/** One line per violation, in the shape a failing assertion should print. */
export function formatViolations(violations: ComparisonViolation[]): string {
  return violations
    .map(
      (violation) =>
        `${violation.file}:${violation.line}:${violation.column}  [${violation.rule}] ${violation.message}\n    ${violation.snippet}`
    )
    .join('\n');
}

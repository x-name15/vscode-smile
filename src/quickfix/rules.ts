/**
 * @fileoverview Safe rule identifiers that can be fixed deterministically via AST manipulation.
 */

/**
 * Readonly array of rule identifiers that can be fixed deterministically via AST manipulation.
 */
export const FIXABLE_RULES = ["missing-operation-id", "missing-summary"] as const;

/**
 * Union type representing rule IDs eligible for safe 1-click Quick Fixes.
 */
export type TFixableRule = (typeof FIXABLE_RULES)[number];

/**
 * Type guard checking whether a given rule identifier is safely autofixable.
 *
 * @param ruleId - The rule identifier string to test.
 * @returns True if the rule is in FIXABLE_RULES, false otherwise.
 */
export function isFixableRule(ruleId: string): ruleId is TFixableRule {
  return (FIXABLE_RULES as readonly string[]).includes(ruleId);
}

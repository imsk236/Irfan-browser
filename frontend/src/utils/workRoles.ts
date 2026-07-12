/** Shared work-level role/source constants (see ADR 0006). Kept outside
 * PersonRoleSection.tsx so component files only export components
 * (react-refresh/only-export-components). */

/** The two sentinel مصدر الصلة radio options; anything else is مرجع آخر free text. */
export const SOURCE_SENTINELS = ["المخطوط", "المفهرس"] as const;
export type SourceSentinel = typeof SOURCE_SENTINELS[number];

/** The three work-level roles with a dedicated single/list slot in WorkForm. Anything else is المساهم. */
export const WORK_FIXED_ROLES = ["مؤلف", "ناسخ", "منسوخ له"];

export function isContributorRole(role: string): boolean {
  return !WORK_FIXED_ROLES.includes(role);
}

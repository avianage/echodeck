// setup and update-username each reimplemented their own username rule with
// a slightly different pattern (one allowed 3+ mixed-case via zod before a
// stricter manual regex, the other only the manual regex) — a username could
// pass one endpoint's check and fail the other's. One shared rule.
export const USERNAME_REGEX = /^[a-z0-9_]{5,20}$/;

export function usernameError(username: unknown): string | null {
  if (typeof username !== 'string') return 'Username is required';
  if (username.length < 5) return 'Must be at least 5 characters';
  if (username.length > 20) return 'Must be at most 20 characters';
  if (!USERNAME_REGEX.test(username)) {
    return 'Only lowercase letters, numbers, and underscores allowed';
  }
  return null;
}

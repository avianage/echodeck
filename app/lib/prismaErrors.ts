/** True for Prisma's "unique constraint violated" error (P2002). */
export function isUniqueConstraintError(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code?: string }).code === 'P2002'
  );
}

/** True for Prisma's "record not found" error (P2025), e.g. deleting a row that's already gone. */
export function isRecordNotFoundError(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code?: string }).code === 'P2025'
  );
}

export enum scopeI {
  passage,
  section,
  chapter,
  book,
  movement,
}

export function asString(scope: scopeI): string {
  return scopeI[scope];
}

export function fromString(scope: string): scopeI {
  return (scopeI as any)[scope];
}

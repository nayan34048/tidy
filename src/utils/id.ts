let counter = 0;

/** Deterministic-ish unique id generator (no crypto dependency needed). */
export function uid(prefix = 'id'): string {
  counter += 1;
  return `${prefix}_${Date.now().toString(36)}_${counter}`;
}

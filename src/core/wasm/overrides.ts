import type { LocalOverrides } from '../config';

/**
 * Normalized representation of local overrides suitable for WebAssembly serialization,
 * where Set instances are transformed into arrays.
 */
export interface WasmLocalOverrides extends Omit<LocalOverrides, 'blockedEdges'> {
  blockedEdges?: string[];
}

/**
 * Serializes and normalizes LocalOverrides before invoking WebAssembly routing functions.
 * Converts JavaScript Set fields (such as blockedEdges) into arrays so serde_wasm_bindgen
 * can deserialize them cleanly without runtime type errors.
 *
 * @param overrides - Optional local overrides containing Maps, Sets, and configs.
 * @returns A normalized overrides object with Set instances transformed into arrays, or undefined if not provided.
 */
export function serializeOverridesForWasm(
  overrides?: LocalOverrides,
): WasmLocalOverrides | undefined {
  if (!overrides) {
    return undefined;
  }

  const result: Record<string, unknown> = { ...overrides };

  for (const [key, value] of Object.entries(overrides)) {
    if (value instanceof Set) {
      result[key] = Array.from(value);
    }
  }

  return result as unknown as WasmLocalOverrides;
}

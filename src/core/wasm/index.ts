import initWasm, { type InitInput, WasmEngine, WasmStreetGraph } from './pkg/ciclista_wasm.js';

let initPromise: Promise<boolean> | null = null;
let initialized = false;

/**
 * Initializes the compiled Rust WebAssembly module for routing and graph operations.
 * Caches the initialization promise so concurrent or repeated invocations execute safely.
 *
 * @param wasmSource - Optional custom WebAssembly module source (URL, Response, bytes, or Module).
 * @returns Resolves to true when the WebAssembly module is successfully initialized, false otherwise.
 */
export async function ensureWasmInitialized(wasmSource?: InitInput): Promise<boolean> {
  if (initialized) {
    return true;
  }

  if (!initPromise) {
    initPromise = (async () => {
      try {
        await initWasm(wasmSource);
        WasmEngine.init_panic_hook();
        initialized = true;
        return true;
      } catch {
        initPromise = null;
        initialized = false;
        return false;
      }
    })();
  }

  return initPromise;
}

/**
 * Indicates whether the WebAssembly engine is currently initialized and ready for computation.
 *
 * @returns True if WebAssembly is initialized and ready.
 */
export function isWasmInitialized(): boolean {
  return initialized;
}

export { WasmEngine, WasmStreetGraph };
export type { InitInput };

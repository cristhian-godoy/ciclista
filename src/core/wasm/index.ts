import { logger } from '../common/logger';
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
        let source = wasmSource;
        if (!source && typeof process !== 'undefined' && Boolean(process.versions?.node)) {
          try {
            const fs = await import('node:fs');
            const path = await import('node:path');
            const wasmPath = path.resolve(process.cwd(), 'src/core/wasm/pkg/ciclista_wasm_bg.wasm');
            if (fs.existsSync(wasmPath)) {
              source = fs.readFileSync(wasmPath);
            }
          } catch {
            // Ignore Node file read fallback failure
          }
        }
        const input =
          source && typeof source === 'object' && !(source instanceof URL)
            ? ({ module_or_path: source } as unknown as InitInput)
            : (source as InitInput | undefined);
        await initWasm(input);
        WasmEngine.init_panic_hook();
        initialized = true;
        return true;
      } catch (error) {
        logger.warn('Failed to initialize WebAssembly engine:', error);
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

export { serializeOverridesForWasm, type WasmLocalOverrides } from './overrides';
export { WasmEngine, WasmStreetGraph };
export type { InitInput };

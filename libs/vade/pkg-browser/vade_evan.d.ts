/* tslint:disable */
/* eslint-disable */
/**
*/
export function set_panic_hook(): void;
/**
* @param {string} log_level
*/
export function set_log_level(log_level: string): void;
/**
* @param {string} method
* @param {string} options
* @param {string} payload
* @param {any} config
* @returns {any}
*/
export function did_create(method: string, options: string, payload: string, config: any): any;
/**
* @param {string} did
* @param {any} config
* @returns {any}
*/
export function did_resolve(did: string, config: any): any;
/**
* @param {string} did
* @param {string} options
* @param {string} payload
* @param {any} config
* @returns {any}
*/
export function did_update(did: string, options: string, payload: string, config: any): any;
/**
* Whitelists a specific evan did on substrate that this private key can create DIDs.
*
* # Arguments
*
* * `did` - Substrate identity to whitelist (e.g. did:evan:0x12345)
* * `private_key` - private key (without '0x' prefix)
* * `identity` - identity without prefix (e.g. 12345)
* @param {string} did
* @param {string} private_key
* @param {string} identity
* @param {any} config
* @returns {any}
*/
export function whitelist_identity(did: string, private_key: string, identity: string, config: any): any;
/**
* Checks whether a given DID is whitelisted and, if not, whitelists it.
*
* # Arguments
*
* * `did` - Substrate did to whitelist (e.g. did:evan:0x12345)
* * `private_key` - private key (without '0x' prefix)
* * `identity` - identity without prefix (e.g. 12345)
* @param {string} did
* @param {string} private_key
* @param {string} identity
* @param {any} config
* @returns {any}
*/
export function ensure_whitelisted(did: string, private_key: string, identity: string, config: any): any;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
  readonly memory: WebAssembly.Memory;
  readonly set_panic_hook: () => void;
  readonly set_log_level: (a: number, b: number) => void;
  readonly did_create: (a: number, b: number, c: number, d: number, e: number, f: number, g: number) => number;
  readonly did_resolve: (a: number, b: number, c: number) => number;
  readonly did_update: (a: number, b: number, c: number, d: number, e: number, f: number, g: number) => number;
  readonly whitelist_identity: (a: number, b: number, c: number, d: number, e: number, f: number, g: number) => number;
  readonly ensure_whitelisted: (a: number, b: number, c: number, d: number, e: number, f: number, g: number) => number;
  readonly __wbindgen_malloc: (a: number) => number;
  readonly __wbindgen_realloc: (a: number, b: number, c: number) => number;
  readonly __wbindgen_export_2: WebAssembly.Table;
  readonly _dyn_core__ops__function__FnMut__A____Output___R_as_wasm_bindgen__closure__WasmClosure___describe__invoke__h92823304181960b5: (a: number, b: number, c: number) => void;
  readonly _dyn_core__ops__function__FnMut__A____Output___R_as_wasm_bindgen__closure__WasmClosure___describe__invoke__h64aa017178946af5: (a: number, b: number, c: number) => void;
  readonly _dyn_core__ops__function__FnMut__A____Output___R_as_wasm_bindgen__closure__WasmClosure___describe__invoke__ha4ba9aa4bde981b7: (a: number, b: number, c: number) => void;
  readonly __wbindgen_free: (a: number, b: number) => void;
  readonly __wbindgen_exn_store: (a: number) => void;
  readonly wasm_bindgen__convert__closures__invoke2_mut__h856cc94be0ac0c61: (a: number, b: number, c: number, d: number) => void;
}

/**
* If `module_or_path` is {RequestInfo} or {URL}, makes a request and
* for everything else, calls `WebAssembly.instantiate` directly.
*
* @param {InitInput | Promise<InitInput>} module_or_path
*
* @returns {Promise<InitOutput>}
*/
export default function init (module_or_path?: InitInput | Promise<InitInput>): Promise<InitOutput>;
        
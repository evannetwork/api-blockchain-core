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

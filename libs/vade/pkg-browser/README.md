# Vade Evan

[![crates.io](https://img.shields.io/crates/v/vade.svg)](https://crates.io/crates/vade-evan)
[![Documentation](https://docs.rs/vade/badge.svg)](https://docs.rs/vade:q)
[![Apache-2 licensed](https://img.shields.io/crates/l/vade.svg)](./LICENSE.txt)

## About

This crate allows you to use to work with DIDs and zero knowledge proof VCs on Trust and Trace.
For this purpose two [`VadePlugin`] implementations are exported: [`VadeEvan`] and [`SubstrateDidResolverEvan`].

## VadeEvan

Responsible for working with zero knowledge proof VCs on Trust and Trace.

Implements the following [`VadePlugin`] functions:

- [`vc_zkp_create_credential_schema`]
- [`vc_zkp_create_credential_definition`]
- [`vc_zkp_create_credential_proposal`]
- [`vc_zkp_create_credential_offer`]
- [`vc_zkp_request_credential`]
- [`vc_zkp_create_revocation_registry_definition`]
- [`vc_zkp_update_revocation_registry`]
- [`vc_zkp_issue_credential`]
- [`vc_zkp_revoke_credential`]
- [`vc_zkp_request_proof`]
- [`vc_zkp_present_proof`]
- [`vc_zkp_verify_proof`]

## SubstrateDidResolverEvan

Supports creating, updating and getting DIDs and DID documents on substrate, therefore supports:

- [`did_create`]
- [`did_resolve`]
- [`did_update`]

### Signing substrate requests

As the did resolver instance needs to sign its requests against substrate, a remote endpoint for signing has to be provided. The DID resolver will sign requests for [`did_create`] and [`did_update`]. A signing endpoint has to be passed with the config argument in the constructor, e.g.:

```rust
let resolver = SubstrateDidResolverEvan::new(ResolverConfig {
    signing_url: "http://127.0.0.1/sign".to_string(),
    target: "127.0.0.1".to_string(),
});
```

`signing_url` will be called with a POST request. The messages that should be signed is passed to the server alongside a reference to a key like this:

```json
{
    "key": "some-key-id",
    "type": "some-key-type",
    "message": "sign me please"
}
```

Two types of of responses are supported. Successful signing results are give in this format:

```json
{
  "messageHash": "0x52091d1299031b18c1099620a1786363855d9fcd91a7686c866ad64f83de13ff",
  "signature": "0xc465a9499b75eed6fc4f658d1764168d63578b05ae15305ceedc94872bda793f74cb850c0683287b245b4da523851fbbe37738116635ebdb08e80b867c0b4aea1b",
  "signerAddress": "0x3daa2c354dba8d51fdabc30cf9219b251c74eb56"
}
```

Errors can be signaled this way:

```json
{
    "error": "key not found"
}
```

[`did_create`]: https://docs.rs/vade_evan/*/vade_evan/resolver/struct.SubstrateDidResolverEvan.html#method.did_create
[`did_resolve`]: https://docs.rs/vade_evan/*/vade_evan/resolver/struct.SubstrateDidResolverEvan.html#method.did_resolve
[`did_update`]: https://docs.rs/vade_evan/*/vade_evan/resolver/struct.SubstrateDidResolverEvan.html#method.did_update
[`SubstrateDidResolverEvan`]: https://docs.rs/vade_evan/*/vade_evan/resolver/struct.SubstrateDidResolverEvan.html
[`Vade`]: https://docs.rs/vade_evan/*/vade/struct.Vade.html
[`VadePlugin`]: https://docs.rs/vade_evan/*/vade/trait.VadePlugin.html
[`VadeEvan`]: https://docs.rs/vade_evan/*/vade_evan/struct.VadeEvan.html
[`vc_zkp_create_credential_definition`]: https://docs.rs/vade_evan/*/vade_evan/struct.VadeEvan.html#method.vc_zkp_create_credential_definition
[`vc_zkp_create_credential_offer`]: https://docs.rs/vade_evan/*/vade_evan/struct.VadeEvan.html#method.vc_zkp_create_credential_offer
[`vc_zkp_create_credential_proposal`]: https://docs.rs/vade_evan/*/vade_evan/struct.VadeEvan.html#method.vc_zkp_create_credential_proposal
[`vc_zkp_create_credential_schema`]: https://docs.rs/vade_evan/*/vade_evan/struct.VadeEvan.html#method.vc_zkp_create_credential_schema
[`vc_zkp_create_revocation_registry_definition`]: https://docs.rs/vade_evan/*/vade_evan/struct.VadeEvan.html#method.vc_zkp_create_revocation_registry_definition
[`vc_zkp_issue_credential`]: https://docs.rs/vade_evan/*/vade_evan/struct.VadeEvan.html#method.vc_zkp_issue_credential
[`vc_zkp_present_proof`]: https://docs.rs/vade_evan/*/vade_evan/struct.VadeEvan.html#method.vc_zkp_present_proof
[`vc_zkp_request_credential`]: https://docs.rs/vade_evan/*/vade_evan/struct.VadeEvan.html#method.vc_zkp_request_credential
[`vc_zkp_request_proof`]: https://docs.rs/vade_evan/*/vade_evan/struct.VadeEvan.html#method.vc_zkp_request_proof
[`vc_zkp_revoke_credential`]: https://docs.rs/vade_evan/*/vade_evan/struct.VadeEvan.html#method.vc_zkp_revoke_credential
[`vc_zkp_update_revocation_registry`]: https://docs.rs/vade_evan/*/vade_evan/struct.VadeEvan.html#method.vc_zkp_update_revocation_registry
[`vc_zkp_verify_proof`]: https://docs.rs/vade_evan/*/vade_evan/struct.VadeEvan.html#method.vc_zkp_verify_proof

# verification and discovery

For the initial motivation and specification, please see [this Tlon-internal document](https://docs.google.com/document/d/1IsxEBe19iF8MFE3vW7SrdIrCOPrK7vUPOmDr-x5laKA/edit). We repeat a high-level overview of the architecture below, before diving into implementation details.

This document is not a replacement for reading the source, but it may help you see the broader picture.

## architecture

`%verifier` is the service agent and supplies all the relevant types. `%lanyard` is a client agent, and interacts with any number of `%verifier` services, but uses Tlon's instance by default.

Hereafter, we will call `%verifier` "the service", `%lanyard` "the client agent", and use "client" to refer to mobile and web user-facing clients.

The service lets users (as urbit ships running the client agent) verify their ownership or control of identifiers. When this process is completed successfully, the service records the verification in its own ledger, and sends the client agent a pair of signed attestations stating that the verification happened.

Currently, four kinds of identifiers are supported: phone numbers, twitter handles, urbit identities, and domain names. The verification flows for each of these differ, but are all implemented in the verifier agent and its types. The flows necessarily overlap when starting and completing registration, but are otherwise distinct state machines. To support a new kind of identifier, see "adding identifiers" below.

The service registers identifier to only a single "owner" at a time. But the client agent could register the same identifier with multiple services.

Where possible, registration employs cryptographic signatures generated by the client ship as proof. This way, publicly-posted verification messages can be validated by outsiders without necessarily having to rely on the service. (See also: Keybase verification tweets.)

## attestations

Upon completing registration, the service gives the new "owner" of an identifier a pair of signed attestations. One is "full", the other is "half". The full attestation contains all metadata about the registration: when it happened, who registered it, _what identifier was registered_, and the proof provided during the registration process if any. The half registration omits the identifier and proof, but does specify the _kind_ of identifier it pertains to. This way, the user may share a proof of having a phone number without divulging the number itself.

Signing is always done using our latest networking keys. The client agent can validate the signature against the networking key it was signed with. Even if that comes up valid, the signature may still have been _revoked_ by the service. To check for this, the client agent must necessarily make a request to the service over the network. Alternatively, the attestation is served over HTTP by the service, if you know the signature, at `/verifier/attestations/0wreal.lylon.gsign.ature`.

## privacy controls

To help preserve the users' privacy, there are a couple of controls and implementation details.

By default, users are _not_ discoverable by the identifiers they register. This can be changed on a per-identifier basis, to either allow discovery altogether (that is, share their `@p` with people who know that identifier), or to only allow discovery by other users who have registered the same kind of identifier.

By default, registered identifiers do not show up in a user's contact agent profile. This can be changed to include and show either the half or full attestation.

The client may change any of these defaults by simply setting them to the desired-default value at the end of the registration flow.

To prevent the service agent from leaking sensitive identifiers to well-intended system administrators, the `/x/debug/state` scry endpoint produces a version of state where the identifier type has its values `@uw`-encoded instead of directly legible.

## abuse prevention

The primary risk with services like this is malicious parties extracting verifications/metadata they shouldn't be privy to. Phone numbers, being a relatively tiny "address space", are particularly vulnerable to this. The service must protect against "brute force discovery".

The service rate-limits most relevant user requests. It uses a rate-limiting scheme where every user starts out with fixed per-endpoint "allowance" that replenishes over time. This allows users to "burst" initially, which could be legitimate usage (ie retrying an OTP code three times due to typos), but doesn't allow users to sustain a request rate beyond the replenishing rate.

The rate-limiting also prevents the service from sending large amount of texts messages (for phone number verification), from easily exceeding its API rate limits, and so on.

For bulk requests, which will eventually be used for discovery (where the "bulk" is made up of entries in the user's phone contact book, or their Twitter "following" list, or similar), we use a dedicated rate-limiting scheme. User contact books may contain many entries, and legitimate usage would want to check all of them. Abusive usage would want to repeatedly check a large amount of numbers also (to brute-force a desired `@p`<->phone nr pair). The difference between legitimate and abusive usage is the rate at which the queried set of identifiers changes. We use that property to detect and limit brute-forcing by implementing "differential contact discovery" as described in [Hagen et al. (2022)](https://eprint.iacr.org/2022/875.pdf).

## logging

The service agent logs into Posthog for key points in the registration flow and all unexpected branches, failure or otherwise. In addition to showing us unexpected errors, this lets us keep an eye out for degenerate cases or abuse attempts.

The client agent logs only in unexpected/failure branches.

The agents' logs may include the user's ship and the _kind_ of identifier being processed, but should **never** include the identifier itself.

## api

The client agent interacts with the service by sending `%verifier-user-command` pokes. It subscribes at `/records/(scot %p our)` to receive `%verifier-update`s about its own registrations. It subscribes at `/endpoint` to learn the service's public HTTP endpoint, which is used for generating attestation URLs to put into contact profile data.

The client agent exposes various scry endpoints, a `/` catch-all subscription endpoint, and `/records` and `/query` subscription endpoints for registration & query updates respectively.

Note that the client agent a `$command:l` type that wraps around the `$user-command` type, to allow specifying which service it needs to go to. Note that its `$update:l` type is different from the ones sent by the service.

## development

### adding identifiers

When adding a new kind of identifier, attend to the following:

- Add it into `.id-type` and `$id-kind` in `/sur/verifier`, and into the custom identifier type in `+on-peek`'s `/x/dbug/state` handling (to obscure user ids from developer eyeballs).
- Add intermediate states and user prompting into `$user-task` and `$user-work` respectively. Leave a comment.
- Assert any necessary prerequisites in the `%verifier-user-command` `%start` handling. Identifier sanity, API key presence, etc.
- If relevant, add API keys into state.
- If verification involves making the user sign a message, define a `$sign-data` and `$payload` type, putting these inside a `+my-id-kind` core in `/sur/verifier`.
- If relevant, add rate-limiting logic where appropriate. Add a field into `$allowance`, `+rates` and `+pool:rates`. Update `+get-allowance` to match. "Pay" allowance during `%start` handling, or `%work` handling, or both, or wherever is appropriate.
- Update `+make-details` in lanyard.

### standard faces

```hoon
id      identifier
key     [host=@p id=identifier]
rec     record, (unit record)
qer     user-query, query:l
res     query-result, result:l
upd     update, update:l
cmd     user-command, host-command, command:l
host    @p running a %verifier agent
```

# Spec Delta

## Purpose

Lets a member who may upload to a bucket learn, before starting, how much upload capacity that bucket has and what per-object limits apply, resolved by the bucket's host against its own hosting account.

## ADDED Requirements

### Requirement: A capacity query rides the request interface

The `%buckets` agent SHALL accept a capacity query for one bucket as an action on its existing request interface, carrying a `request-id`, and SHALL answer it with exactly one terminal response on the requester's request subscription. Because the answer waits on Memex, `pending` is permitted before the terminal answer whether the bucket is local or hosted elsewhere, and a requester SHALL treat it as non-terminal.

#### Scenario: Local bucket answered by its host

- **WHEN** a local client sends a capacity query for a bucket this ship hosts
- **THEN** the agent answers `pending` on the local request path and, once Memex has answered, one terminal response under the same `request-id`

#### Scenario: Remote bucket forwarded to its host

- **WHEN** a local client sends a capacity query for a bucket hosted by another ship
- **THEN** the agent forwards the query to the host, answers `pending` locally, and relays the host's terminal response under the same `request-id`

#### Scenario: Host does not answer

- **WHEN** a forwarded capacity query receives no terminal answer from the host within the agent's request window
- **THEN** the requester receives the same timeout error every other forwarded action receives

### Requirement: The host gates the query on write access

The bucket host SHALL authorise a capacity query by the requesting ship as taken from the request's origin, and SHALL answer it only when that ship has write access to the bucket under the same rule that admits an upload. A ship without write access SHALL be answered `not-authorized` and Memex SHALL NOT be consulted.

#### Scenario: Writer is answered

- **WHEN** the requesting ship is a group admin, or the bucket's writer set is empty and the ship may read the bucket, or the ship holds a role in the bucket's writer set
- **THEN** the host proceeds to resolve the bucket's capacity

#### Scenario: Reader without write access is refused

- **WHEN** the requesting ship may read the bucket but holds no role in a non-empty writer set and is not an admin
- **THEN** the host answers `not-authorized` without calling Memex

#### Scenario: Non-member is refused

- **WHEN** the requesting ship is not a member of the bucket's group, or the group no longer exists on the host
- **THEN** the host answers `not-authorized` without calling Memex

### Requirement: Capacity is resolved for the bucket host's hosting account

The host SHALL ask Memex for the capacity of the bucket it hosts, authenticated as itself, and Memex SHALL answer for the hosting account that owns the host ship. The requester's own hosting account SHALL play no part in the answer.

#### Scenario: Member of another account's bucket

- **WHEN** a ship on hosting account A queries the capacity of a bucket hosted by a ship on hosting account B
- **THEN** the answer reflects account B's tier and usage

#### Scenario: Usage elsewhere on the account reduces the answer

- **WHEN** account B has legacy attachments, objects in other buckets, or live upload reservations
- **THEN** the remaining bytes and file count answered for the bucket are reduced by all of them

### Requirement: Memex authenticates the host and refuses an unhosted or unowned host

Memex SHALL answer a capacity query only when the caller presents a valid landscape token for the host it names, buckets are enabled for that host, and that host has an active hosting owner. Any other case SHALL be refused with a typed error, and the host SHALL relay that refusal to the requester rather than answering from any other source.

#### Scenario: Valid host

- **WHEN** the host's token is valid, buckets are enabled for it, and it has an active hosting owner
- **THEN** Memex answers with the account's capacity

#### Scenario: Host with no hosting owner

- **WHEN** the host's token is valid but no active hosting owner is recorded for the ship
- **THEN** Memex refuses, and the requester receives a typed error carrying Memex's account of the refusal

#### Scenario: Host not enabled for buckets

- **WHEN** buckets are disabled globally or the host is outside the enabled set
- **THEN** Memex refuses with the same error it gives an upload grant in that state

#### Scenario: Host cannot reach Memex

- **WHEN** the host has no broker credential or the call to Memex fails or is cancelled
- **THEN** the requester receives the same unreachable or outcome-unknown error an upload grant produces in that state

### Requirement: The answer carries remaining capacity and per-object limits

A successful capacity answer SHALL carry the remaining bytes, the remaining file count, the maximum bytes per object, and the set of allowed MIME types, with the remaining values as exact integers clamped at zero. The MIME set is Memex's allowlist as configured: an empty set means any type is permitted, and an entry MAY be a wildcard of the form `type/*`.

#### Scenario: Room remains

- **WHEN** the account's usage is below its tier's byte and file limits
- **THEN** remaining bytes and remaining files are the exact differences, with no rounding

#### Scenario: Usage exceeds the tier

- **WHEN** the account's usage is above its tier's byte limit or file limit, as after a downgrade
- **THEN** the corresponding remaining value is zero, never negative

#### Scenario: Account has no tier of its own

- **WHEN** the hosting account has no storage tier assigned
- **THEN** the answer is computed against the default tier, as an upload grant would be

#### Scenario: Limits are those an upload would face

- **WHEN** a capacity answer is produced for a host
- **THEN** its per-object byte limit and allowed MIME types are the values an upload grant for that host enforces

#### Scenario: No MIME allowlist is configured

- **WHEN** Memex has no MIME allowlist configured
- **THEN** the answer's MIME set is empty, and an upload of any type is admitted

### Requirement: The answer discloses nothing beyond upload admission

A capacity answer SHALL NOT disclose the hosting account's identity, its tier name, other buckets or their contents, storage credentials, or object paths.

#### Scenario: Answer contents

- **WHEN** a capacity query succeeds
- **THEN** the answer contains only the four capacity fields and no identifier of the account, tier, or other buckets

### Requirement: The answer is advisory

A capacity answer SHALL reserve nothing, and an upload grant made after a query SHALL be admitted or refused on the account's usage at grant time, not on the answer.

#### Scenario: Room taken between query and grant

- **WHEN** a client receives an answer showing room and another upload on the same account consumes it before the client's grant
- **THEN** the grant is refused for quota as it would be without the query

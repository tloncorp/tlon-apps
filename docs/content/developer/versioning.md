---
title: Agent versioning
weight: "40"
---

# Agent versioning

## Introduction 
To preserve the state across program and type changes, gall
agents tag their state type with an explicit version number.

```hoon
+$  state-1  [%1 my-state]
```

This enables the agent to discriminate the current state, and use the correct
procedure for upgrade.

If an agent never communicated with the outside world, that would be
sufficient. However, as soon as two parties are communicating with types, it is
necessary to either make sure everyone is up to date, or use a versioning
scheme for these types. The former is only feasible in a strictly local API. As
soon as remote parties are involved, it is no longer possible to ensure they
always stay in sync. In this case, we can either resort to blocking, or we may
introduce a running version tag for each communicated type, that would allow the remote
party to detect and deal with a possible incompatibility.
```hoon
:: an example of two versions of a type
::
+$  diary-1  [content=(list @t)]
+$  diary-2  [content=(list @t) pages=@ud]
```
In addition, since the agent state type will usually depend, directly or
indirectly, on at least some of these versioned types, a change of one type will
propagate through a network of type dependencies, forcing all affected type to
increase their version as well.

## Versioning scheme

In a Hoon application the following program components may be versioned.

1. Types
2. Application state
3. Marks
4. Scry paths
5. Subscription paths

Among these, the types are the most basic component and usually influence the
version of the other three components.

## Three type categories

Types are the woven fabric of an application. A change in a single type may
ripple to affect a number of other types, sometimes effecting a change of the
application state. If a type is transferred over a network, a mark or a path 
may be affected as well. However, it is the application state type
that is almost always linked with application type changes. 

We distinguish the following three categories of types.

1. _State type_ – it is the underlying type of a particular version of the
   application state.
2. _Anchored type_  – a type dependency of a state type. This dependency can be
   direct or indirect.
3. _Loose type_ – a type which is neither a state type nor anchored type.

### State types 

A complex application usually possesses several state types at
different versions. State types are defined in the main application file.

### Anchored types 

Most of the types defined in an application structure file are in fact
anchored types that are direct or indirect dependencies of the state type. Any
type which depends on an anchored type in turn becomes an anchored type, even
though it needn't be an explicit part of the application state.

### Loose types 

Such types can arise in intermediary computation which is not
stored as part of the state at any point. Loose types are quite uncommon in
networked Urbit applications, but do arise, for instance, as types
constructed only for transmission.

## Versioning of types

### State types

In the proposed scheme, the version of the application state plays the crucial
role. The version of the state begins at `%0` and advances in two scenarios. 
(1) A change in any one of the anchored types affects the underlying state
type, and thus requires a version number increase. (2) Less commonly, there
arises a need to apply a state change during `+on-load`, such as when fixing a
bug. This too requires a version change to distinguish instances where the
change had already come into effect.

### Anchored types 

A type change of an anchored type must increase the version
number of the application state type. Thus, it is natural to consider the state
version an _anchor_ for the whole set of anchored types. Simple types which are
unlikely to change may remain implicitly anchored and never gain an explicit
version anchor. When a type becomes explicitly anchored, it gains a version
anchor corresponding to the earliest state version at which the type became
anchored. 

### Loose types 

Loose types, since they are not dependent on any of the anchored types,
can be robustly versioned using a running version tag if more than one version
of the type is required. If at one point a loose type is anchored, it loses the
version tag and becomes anchored at a given state version anchor.

## Versioning of marks 

Historically, application marks has been versioned in a way that is
unrelated to the version of a type, if there were any. The mark version number
would start either at `0` or `1`, and would increase any time the underlying
mark type has changed. This has the obvious disadvantage of having to keep
track of, and manage, yet another version number. 

However, in practice we find
that it is more meaningful to have a running mark version, than let a mark inherit
the version of its type.

_This has not occured in practice thus far, but what about mark conversion api?
 Any incompatible change should probably affect the version number as well._

## Versioning of paths 

Path version can change both as a consequence of a
mark-type change, or a change in behavior. Furthermore, scry paths are
sometimes found to return types constructed inline, for which no version number
can be suitably defined. Thus, it is not possible to tie the path version
number with a type in the same way as with marks, neither it is desirable to do
so.

Path versions begin at `v1`. `v0` is kept as an implicit default for
unversioned paths. The version tag should always be the first component of a path, 
to allow easy discrimination between different version of semantically equivalent paths.
Each time a path is affected by a change in type or other incompatible change 
its version number increases.

### Versioning of wires

Wires, on the other hand, should remain unversioned. This is because an agent
will typically use protocol negotiation library, and facts received will
usually be at the latest version of a type. In addition, facts also carry a
mark which can be used to discriminate between types. 



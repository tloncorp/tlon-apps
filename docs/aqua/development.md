# Aqua test development

Aqua tests allow a test to execute in a reproducible, virtual urbit environment.
When a test runs, it is presented with:
1. A clean slate fleet of virtual ships, usually galaxies.
2. A connection to the aqua virtual runtime, which allows it to
   interface with running virtual ships.

A single test file can define any number tests. Between the run of each test,
the test runner thread `-ph-test` takes care of resetting the test environment.

## The Structure of Aqua Tests

Each aqua tests is a core with test arms, where each
test arm has the prefix `ph-test` and resolves to a strand with the signature `(strand ,~)`.

The thread runner builds a test file, extracts and builds all matching test arms.
To run a test, the runner will restore the specified aqua snapshot, and run the defined
test thread. If the thread returns a null, it means the execution was successful.
A thread failure indicates test failure. The test runner then displays the error.

Here is an example test file with a single test case `+ph-test-sleep`.
It waits for `~s5` and always return successfully.
```hoon
/-  spider
/+  *ph-io, *ph-test
=,  strand=strand:spider
::  +ph-test-sleep: sleep test
::
++  ph-test-sleep
  =/  m  (strand ,~)
  ^-  form:m
  ;<  ~  bind:m  (sleep ~s5)
  (pure:m ~)
--
```

If the test thread were to hang and never return, the test runner would eventually timeout
the test and report a failure.

### Libraries

Let's look at the imports in the above example. The `spider` sur file is the thread interface.
Since each test case is a thread, we generally use it, primarily to define the strand type.

Next, we have `ph-io`. This is the library for interacting with the aqua runtime from threads, and defines
strands to send events to aqua and other utilities.

Finally, `ph-test` is a dedicated library for writing aqua tests. It currently contains many useful utilities
missing from `ph-io`, such as strands interfacing with virtual ships: poking, watching, receiving facts and scrying.
It also contains test assertions, such as `+ex-equal`, `+ex-not-equal`.

## Developing Aqua Tests

When developing a new aqua test, we start by specifying the scope of the test. The scope could encompass
a single system component, such as a single gall agent, or target multiple system components involved
in the process under testing.

Once we have identified the components we then prepare appropriate snapshot with a fleet size big enough
to accommodate test scenarios.

While we develop the test, we can use a snapshot targeted to our use case.
However, when the new test ships to production, we must make sure that the snapshot used in production
has a big enough fleet size. If that is not the case, the production
test runner must be updated.

### Test scenarios

Each test arm should correspond to a single test scenario.
When developing a new test, we start out by describing the scenario
in the comment directly above the test arm. The test scenario should be
be brief and written from third-person perspective. It should not
overwhelm the reader with too much detail, but should contain essential
information about assertion made during the test.
Here is an example test arm for the group join process:
```hoon
::  +ph-test-group-join: test group joins
::
::  scenario
::
::  ~zod hosts a group and sends an invitation to ~bud.
::  ~bud receives the invitation and joins the group successfully,
::  receiving the group creation fact.
::
++  ph-test-group-join
  =/  m  (strand ,~)
  ^-  form:m
::...
```

## Comment style guide

Following a long maritime tradition, Urbit ships generally use feminine pronouns.
However for galaxies, which hold authority over the network, use masculine pronouns.

In comments describing a sequence of assertions, try to use sequential
language. For instance, prefer "then" rather than "and" to describe a
sequence of events happening one after another. This is rule is not absolute,
sometimes, especially when talking about events concerning the same
ship, we might profitably employ "and".

Prefer "and" to "then" especially if two events logically follow one another
in the context of the test. For example, we prefer to use "and" in "~zod hosts a
group and invites ~bud", since in the context of the test, there is no
decision on `~zod`'s part involved: the group was created _so that_
`~bud` could join it.

### Test assertions

Aqua tests do not have direct access to the underlying gall agent. The
test can only interface with the virtual ship through arvo tasks.
The perspective is that of a client integrating with a particular system component.

When testing gall agents, we have essentially two ways to approach test
assertions. The first one is to establish a subscription and assert on
facts. The second is to directly query an agent state with a scry.

Here is the full group join test
```hoon
++  ph-test-group-join
  =/  m  (strand ,~)
  ^-  form:m
  ;<  ~  bind:m  (watch-app /~bud/groups/v1/groups [~bud %groups] /v1/groups)
  ;<  ~  bind:m  (watch-app /~bud/groups/v1/foreigns [~bud %groups] /v1/foreigns)
  ::  ~zod hosts a group and invites ~bud
  ::
  =/  =create-group:g
    :*  %my-test-group
        ['My Test Group' 'My testing group' '' '']
        %secret
        [~ ~]
        (my ~bud^~ ~)
    ==
  ;<  ~  bind:m  (poke-app [~zod %groups] group-command+[%create create-group])
  ::  ~bud joins the group using received invite token
  ::
  ;<  kag=cage  bind:m  (wait-for-app-fact /~bud/groups/v1/foreigns [~bud %groups])
  ?>  =(%foreigns-1 p.kag)
  =+  !<(=foreigns:v8:gv q.kag)
  =+  foreign=(~(got by foreigns) my-test-flag)
  ?>  ?=(^ invites.foreign)
  =/  =a-foreigns:v8:gv
    [%foreign my-test-flag %join token.i.invites.foreign]
  ;<  ~  bind:m  (poke-app [~bud %groups] group-foreign-2+a-foreigns)
  ;<  ~  bind:m  (ex-r-groups-fact ~bud ~zod^%my-test-group %create)
  (pure:m ~)
```
We first establish two app subscriptions to `%groups` on `~bud`.
After `~zod` created the group, we expect `~bud` to first receive the
group invitation on the foreigns subscription. After we have verified
that an invitation has indeed been received, we poke `~bud` to join the
group. We verify that the group has been successfully joined by
expecting a group creation response on the groups subscription.

### Test assertions and Hoon assertions

When asserting on a value expected by the test, we have two choices.
We can aqua assertion, such as `+ex-equal`. This will terminate the
thread with an appropriate error message, describing the discrepancy
between expected and actual values. Alternatively, we can use any of the
Hoon assertions such as `?>` or `?<`, which will simply crash the thread
without a specific error message. The obvious downside of Hoon
assertions is that they don't carry any information about the way
assertion has failed.

We should generally use aqua assertions. However, when asserting on
things that are considered unchengable parts of an interface, and do not in
themselves implement any logic which could be broken, using
Hoon assertions is permissible. One example is asserting on marks of
received facts. Since these are generally considered fixed, crashing
with a Hoon assertions is more ergonomic.

Sometimes we might be tempted to use Hoon assertions out of pure convenience,
such using crashing map getter `+get:by`, or unpacking a unit using `?>`.
However, taking such shortcuts will simply make for a later inconvenience when debugging a
broken test.

When investigating a test failing on a Hoon assertion, which does not
display any values, using the debug print rune `~&` can be a good way to
investigate the problem. If the test failure does not stem from an
originally wrong implementation, it is likely the case that it could be
broken in the future and we should consider to convert it to an aqua
assertion.

### Implementing a test

We have so far talked about the structure of an aqua test. It is
composed of a prose description, followed by the test strand
implementation, which essentially is a sequence of events send to the aqua runtime
or assertions on various effects received.

We are now going to focus on the test implementation. Once we have
specified the test scenario, how do we go about implementing it?
In some cases, it might be enough to look at relevant portions of the code to
be able to specify the sequence of events and assertions. However,
discerning the exact test process and data involved is not always easy just
by reading the code. Sometimes, the functionality might be spread across many libraries
or agents.

Fortunately, we can observe the running system by enabling debugging mode.
Any agent that integrates the logging library, together with the verb wrapper, will
display debugging messages when enabled. To enable debugging mode, we adjust the logging
volume
```
> :agent &verb [%volume volume]
```
where volume can be any of `%dbug`, `%info`, `%warn` and `%crit`.
Adjusting the volume to `%dbug` will enable printing of all log messages at that priority or above.



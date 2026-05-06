# Aqua test development

Aqua tests allow a test to execute in a reproducible, virtual urbit environment.
When a test runs, it is presented with:
1. A clean slate fleet of virtual ships, usually galaxies.
2. A connection to the aqua virtual runtime, which allows to
   interface with running virtual ships.

A single test file can define multiple tests. Between the run of each test,
the test runner thread `-ph-test` takes care of resetting the test environment.

## Updating the desk

When changes have been made in the repository and are ready to be tested
on a running ship, use `rsync` or equivalent command to copy the `desk/` in the repository
to appropriate pier. This will put the files into the ship's desk unix mount point.
To make the changes visible on the ship, you must also issue `|commit` command, which
will detect any changes in the unix mount point directory.

Important: do not delete files not present in the repository at the destination.
Running urbit desks are usually supplemented with other neccessary files not present
in the repository.

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

When developing a new aqua tests, we start by defining the scope of the test. The scope could encompass
a single system component, such as a single gall agent, or target multiple system components involved
in the process under testing.

Once we have identified the components, we then prepare appropriate snapshot with a fleet size big enough
to accommodate test scenarios.

While we develop the test, we can use a snapshot targeted to our use case.
However, when the new test ships to production, we must make sure that the snapshot used in production
has a big enough fleet size.

### Test scenarios

For each test scenario of the system, we start by writing a conscise description
of the test at the top of an appropriately named test arm. It should contain
1. A clear one line description of the test.
2. The test scenario, written from a third-person perspective. It should
   contain the most important expect assertions involved in the test.

Here is an example test arm for the group join process
```hoon
::  +ph-test-group-join: test group joins
::
::  scenario
::
::  ~zod hosts a group. ~bud joins the group. we verify
::  that the subscription lifecycle follows through %watch, and then %done.
::  finally, the group creation response is received.
::
::
++  ph-test-group-join
  =/  m  (strand ,~)
  ^-  form:m
```

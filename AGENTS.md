# Tlon Messenger backend
The backend of the Tlon Messenger app is hosted on the Urbit platform.

All the backend code is located in the desk/ directory, which
is deployed to an urbit ship.

## Development
Interfacing with an Urbit ship for the purpose of development
can be done in a variety of ways. Currently, the two primary options
are:
1. Interfacing using clurd tooling
2. Interfacing through a running mcp server hosted on an Urbit ship

Both of these require developer setup, and are not part of the
repository.

Interfacing through clurd requires access to the clurd
directory, which contains tooling and useful documents for working
with a running Urbit development ship.

Interfacing through an MCP server requires an Urbit development ship
with an enabled MCP

When asked to perform backend development work, check with the
user for the preferred interface.

## Deploying the desk
To deploy desk/ changes to a ship, simply use rsync to copy
the desk/ directory to a corresponding mounted desk in the ship's pier.
However, remember **not to delete** existing files in the mounted desk.
The deployed desk contains necessary files which are not preserved in
this repository.
The user should point to the correct location where the pier is located.

## Compiling the desk
Once the changes in the repository have been copied over to the ship, it
can be compiled.
Issue `|commit groups` with long-enough timeout. For small changes, a timeout
of under 1 minute can be sufficient. For changes involving sur
files or libraries used by many agents, a timeout of 2 or 3 minutes might be necessary.


## Rerunning commands with clurd
Clurd tooling is not able to capture an output of a command
past the specified timeout. When we need to rerun a command,
especially if we suspect output has been missed, we need to:
1. Interrupt the previous command, which could still be runnig
2. Repeat the command with a longer (or shorter) timeout

## Backend tests

There are two kinds of backend tests in groups. The first kind uses the
`/lib/test-agent.hoon` library, which provides a monadic framework for
implementing gall agent tests. It works by simulating rudimentary gall
functionality, which allows testing of the agent core (which is a pure function of
agent state) under the variety of circumstances.

test-agent tests are typically located in `/tests` directory, under the
corresponding desk entry. For example, tests for `/app/groups.hoon`
agent would be located at `/tests/app/groups.hoon`.

The second kind of tests uses aqua ship virtualization technology.
Using aqua, a virtual fleet of ships can be run directly on the
development ship with little resource cost. While these ships are not
fully-featured and do not support every urbit runtime event, they
nonetheless allow testing of gall agents running on a virtualized ship.

Aqua tests are located in `/tests/ph` directory.

These two kinds of tests use different arm prefix to avoid having a
runner execute a wrong kind of test. test-agent test arms use a `test`
prefix, while aqua tests use `ph-test` prefix.

## Running test-agent tests
The test runner is the `-test` thread, which will scan the directory
to find tests, and execute them one-by-one, reporting failures.
Use `-test /=groups=/tests` to run all tests in the directory.

To target a specific file and test arm, use the `-test /=groups=/tests/path/arm`
syntax.

## Running aqua tests
Aqua tests use a similar setup to test-agent tests.
There is a dedicated test runner `-ph-test`, which is located in the
groups desk. (To invoke the thread from a particular desk, we use the
`-desk!thread` syntax.)

Use `-groups!ph-test /=groups=/tests/ph` to run all aqua tests in the
`/tests/ph` directory.

To target a specific file and test arm, use the `-groups!ph-test
/=groups=/tests/ph/path/arm` syntax.



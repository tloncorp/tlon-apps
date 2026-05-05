# Aqua tests

## Preparing aqua pill

Before aqua can run virtual ships, the aqua pill must be prepared.This
pill is used to boot each virtual ship. Once aqua has been initialized with the pill
there is no need to reinitialize it unless:
1. Aqua state has been reset.
2. We want the pill to incorporate some changes, such as an updated desk or additional files.

To initialize aqua with a fresh pill, we poke aqua with an assembled pill. This
can be done in one go by using the brass pill generator.
```
> :aqua &pill +pill/brass %base desk1 desk2
```

The brass pill takes a list of desks as an argument. The `%base` desk is required.

Brass pill generation takes about 5 minutes or longer to complete.

## Preparing aqua snapshot

Each aqua test requires a reproducible environment consisting of a
fleet of virtual ships. It would be too expensive to boot the fleet
each time a test runs. Fortunately, aqua provides a way to snapshot a booted
set of ships. A snapshot can then be restored each time a test runs, providing
a fast way to initialize a test environment.

To prepare a snapshot, decide upon a number of virtual ships required.
Since aqua tests use a hardcoded set of ships, by convention we use galaxies
in enumeration order as test ships. Thus, for a test involving 4 ships we would have
`~zod`, `~nec`, `~bud` and `~wes`. If more ships are required, discover the n-th galaxy id by using
```
> `@p`n
```

Prepare the snapshot by running
```
> -desk!ph-fleet fleet sync
```
where `fleet` is the list of ships and `sync` is the desk sync flag.
Default the sync flag to `|`, unless there has been changes to the desk.
Currently, syncing desk to virtual ships takes quite some time.

The thread will prepare an aqua snapshot, and return the snapshot id.
You can save it to a dojo variable with
```
> =snap-id -desk!ph-fleet fleet sync
```

In addition to galaxy test ships, a test may require a number of _provider_
ships to be running, to allow components of the system to properly integrate
with remote services.

In the groups desk, we need `%bait` and `%notify` providers, running on `~loshut-lonreg`
and `~rivfur-livmet` respectively. In addition, virtual ames/mesa networking requires
the parent galaxies to be present. In this case, we must add `~fen` and `~dem` to the
fleet. This is handled by the `-ph-fleet` thread

## Running tests

To run aqua tests use the `-ph-test` test runner supplied with the desk.
```
> -desk!ph-test `path snap
```
The `path` is a directory containing aqua tests. Supply `~` to run from the default directory.
It will be scanned recursively, and any tests found will be build and scheduled to be run.

`snap` is the aqua snapshot on which tests are going to run.

The standard location for aqua tests is in the desk's `/tests/ph` directory.
The path can be extended to target a particular component. For instance, to
run only aqua tests for the group agent, use `/tests/ph/app/groups`.
You can also target a particular test by appending the test name, such as
`/tests/ph/app/groups/ph-test-group-join` to run only the groups group join test.

The current virtual ames driver is inefficient. This make a single test run take
about `~20s`, or more, depending on the number of networked interactions between
virtual ships.

### Understanding test output
While tests run, information will be displayed from a variety of sources.
The test runner will display test result and time taken after run of each test case.
The aqua virtual runtime is currently quite verbose, and will display a lot of noise,
primarily about unhandled effects.

Running virtual ships will also display logging messages. 
These messages are associated with a priority:
| prefix    | priority |
|-----------|----------|
| no prefix | `%dbug` debug priority       |
| `>`       | `%info` information priority |
| `>>`      | `%warn` warning priority     |
| `>>>`     | `%crit` critical priority    |
Each logging message is prefix by the virtual source ship and agent names.

An example error message
```
>>> [~zod/groups] Critical failure in +se-u-groups
```
means the `%groups` agent running on `~zod` is reporting an error generated
in `+se-u-groups` arm.

Since the logging messages are not associated with a particular location
in the source code, to find the originating location we can either start with
the location indicated in the message. In the above example, that would
be the `+se-u-groups` arm somewhere in the agent's source code or its libraries.
If that does not yield results, searching for constant parts of the messsage in relevant files usually.

## Listing tests
To find available aqua tests, use `-ph-test-ls path` command.
It will compile all files present at the path and assemble a list
of test arms that would be run by the test runner.

## Cancelling a test run
The test runner is a thread, so in order to stop an ongoing test run you must
cancel the runner thread. In dojo, this is simply done by pressing a backspace.


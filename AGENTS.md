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






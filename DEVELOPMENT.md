# Development

These instructions are for working on Groups and Talk as a developer at Tlon.

## Project Structure

- `/desk`: The folder containing the desk for Groups. This currently contains the agents for all other apps.

- `/talk`: Holds the necessary files for the app to appear as a tile, but all agents are located in the groups desk.

- `/ui`: Groups and Talk are built primarily using [React], [Typescript], and [Tailwind CSS]. [Vite] ensures that all code and assets are loaded appropriately, bundles the application for distribution and provides a functional dev environment.

## Getting Started

To get started using Groups, run `npm install` inside the `ui` directory.

To develop, you'll need a running ship to point to. To do so you first need to add a `.env.local` file to the `ui` directory. This file will not be committed. Adding `VITE_SHIP_URL={URL}` (where **{URL}** is the URL of the ship you would like to point to) will allow you to run `npm run dev`. This will proxy all requests to the ship except for those powering the interface, which lets you work with live data.

Regardless of what you run to develop, Vite will hot-reload code changes as you work so you don't have to constantly refresh.

## Fakezod Development

Follow these instructions or use Tlon's own
[Bouncer](https://github.com/tloncorp/bouncer) utility (requires Ruby 3+).

0. Clone or pull latest versions of this repo and `urbit/urbit`.
1. Boot a fake ship. Use local networking with `-F` like so:
   `urbit -F zod`
2. Mount or create the appropriate desks on local `~zod`:
   1. `|mount %garden`
   2. `|merge %groups our %base`
   3. `|mount %groups`
3. From the `urbit/urbit` repo:
   1. `rsync -avL --delete pkg/garden/* ~/urbit/zod/garden/`
   2. `rsync -avL --delete pkg/base-dev/* ~/urbit/zod/groups/`
   3. `rsync -avL pkg/garden-dev/* ~/urbit/zod/groups/`
4. From this repo:
   1. `rsync -avL desk/* ~/urbit/zod/groups/`
   2. `rsync -avL landscape-dev/* ~/urbit/zod/groups/`
5. Commit and install garden on local `~zod`:
   1. `|commit %garden`
   2. `|install our %garden`
6. Similarly commit and install Groups:
   1. `|commit %groups`
   2. `|install our %groups`

## Deploying

Groups and Talk are distributed via the Urbit network by way of a [glob](https://developers.urbit.org/reference/additional/dist/glob#-make-glob), or a Landscape application bundle. Instructions are as follows:

0. Run `npm run build` in the `ui` directory, which outputs to `/dist`.
1. Create or launch an urbit using the -F flag.
2. On that urbit, if you don't already have a desk to run from, run `|merge %work our %base` to create a new desk and mount it with `|mount %work`.
3. Now the `%work` desk is accessible through the host OS's filesystem as a directory of that urbit's pier ie `~/zod/work`.
4. From the `ui` directory you can run `rsync -avL --delete dist/ ~/zod/work/groups` where `~/zod` is your fake urbit's pier.
5. Once completed, run `|commit %work` on your urbit and you should see your files logged back out from the dojo.
6. Run `=dir /=garden` to switch to the garden desk directory.
7. Run `-make-glob %work /groups`. This will create a glob from the folder where you just added files. It will output to `~/zod/.urb/put`.
8. Navigate to `~/zod/.urb/put` you should see a file that looks something like: `glob-0v5.fdf99.nph65.qecq3.ncpjn.q13mb.glob`. The characters between `glob-` and `.glob` are a hash of the glob's contents.
9. Upload the glob to any publicly available HTTP endpoint that can serve files. This allows the application to be distributed over HTTP.
10. Once you've uploaded the glob, update the corresponding entry in the docket file at `desk/desk.docket-0`. Both the full URL and the hash should be updated to match the glob we just created, on the line that looks like this:

```hoon
glob-http+['https://bootstrap.urbit.org/glob-0v5.fdf99.nph65.qecq3.ncpjn.q13mb.glob' 0v5.fdf99.nph65.qecq3.ncpjn.q13mb]
```

11. The docket file containing a pointer to the new glob can now be safely committed and deployed via the Urbit network.

## Husky

This project uses husky to run git pre-commit hooks. You may disable Husky by adding `HUSKY=0` to your `.zshrc` or `.bashrc`.

[react]: https://reactjs.org/
[typescript]: https://www.typescriptlang.org/
[tailwind css]: https://tailwindcss.com/
[vite]: https://vitejs.dev/

## Glossary

_bloc_
: superuser sects

sects in the bloc set are allowed to make modifications to the group, and its various metadata and permissions

_brief_
: a representation of the last thing we've seen, and how many new items since

_cabal_
: contains the metadata for a role

_chat_
: backend term for a group chat

_club_
: backend term for a multi-DM group (distinct from a `chat` and a `dm`)

_cordon_
: represents a group's permissions. `open` allows anyone to enter but
those banned, `shut` requires requesting to join, `afar` is a custom policy
determined by another agent

_curio_
: represents an item in a collection

_dm_
: backend term for a 1:1 message

_flag_
: composite identifier consisting of `ship/group-name` used to key state and in routes

_fleet_
: the map of ships that are part of a group

_gang_
: a group invite

_heap_
: a collection

_sect_
: a term representing a role

_stash_
: all heaps we are a part of

_vessel_
: represents the roles a group member has and their join time

_bloc_
: roles that have superuser perms (default is admin)

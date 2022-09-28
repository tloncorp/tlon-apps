# Groups and Talk

Start, host, and cultivate communities with Groups. Own your communications, organize your resources, and share documents. Groups is a decentralized platform that integrates with Talk, Notebook, and Gallery for a full, communal suite of tools.

Send encrypted direct messages to one or many friends with Talk. Talk is a simple chat tool for catching up, getting work done, and everything in between.

- [Learn more about Tlon Corporation →](https://tlon.io/)
- [Learn more about Urbit →](https://urbit.org/)

## Coming Soon

Groups and Talk are under active development with a full 1.0 release date in sight. We are currently working on:

- Mobile-responsive layout and interaction fixes
- Mute controls for all notification-producing events, by type or in specific instances
- Secret, invite-only groups
- Group templates for new groups
- Emoji reactions
- An as-is port of the S3 uploader in [Groups 1](https://github.com/urbit/urbit/tree/master/pkg/interface)

## Coming Later

- Arrangeable ordering in Notebooks and Gallery
- Blocking users in Talk
- Rich embeds of web2 content
- Content search within channels
- Standalone Notebook, Gallery, and Contacts apps in Landscape
- Remote storage updates
- Group discovery and user onboarding updates

---

## Working on Groups and Talk

### Project Structure

- `/desk`: The folder containing the desk for Groups. This currently contains the agents for all other apps.

- `/talk`: Holds the necessary files for the app to appear as a tile, but all agents are located in the groups desk.

- `/ui`: Groups and Talk are built primarily using [React], [Typescript], and [Tailwind CSS]. [Vite] ensures that all code and assets are loaded appropriately, bundles the application for distribution and provides a functional dev environment.

### Getting Started

To get started using groups first you need to run `npm install` inside the `ui` directory.

To develop you'll need a running ship to point to. To do so you first need to add a `.env.local` file to the `ui` directory. This file will not be committed. Adding `VITE_SHIP_URL={URL}` (where **{URL}** is the URL of the ship you would like to point to) will allow you to run `npm run dev`. This will proxy all requests to the ship except for those powering the interface, which lets you work with live data.

If you would like to run a development version locally against a fakezod, see [DEVELOPMENT.md](/DEVELOPMENT.md) in this repository or Tlon's own [Bouncer](https://github.com/tloncorp/bouncer) utility.

Regardless of what you run to develop, Vite will hot-reload code changes as you work so you don't have to constantly refresh.

### Deploying

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

### Husky

This project uses husky to run git pre-commit hooks. You may disable Husky by adding `HUSKY=0` to your `.zshrc` or `.bashrc`.

[react]: https://reactjs.org/
[typescript]: https://www.typescriptlang.org/
[tailwind css]: https://tailwindcss.com/
[vite]: https://vitejs.dev/

## Glossary

*brief*
: a representation of the last thing we've seen, and how many new items since

*cabal*
: contains the metadata for a role

*chat*
: backend term for a group chat

*club*
: backend term for a multi-DM group (distinct from a `chat` and a `dm`)

*cordon*
: represents a group's permissions. `open` allows anyone to enter but 
those banned, `shut` requires requesting to join, `afar` is a custom policy
determined by another agent

*curio*
: represents an item in a collection

*dm*
: backend term for a 1:1 message

*flag*
: composite identifier consisting of `ship/group-name` used to key state and in routes 

*fleet*
: the map of ships that are part of a group

*gang*
: a group invite

*heap*
: a collection

*sect*
: a term representing a role

*stash*
: all heaps we are a part of

*vessel*
: represents the roles a group member has and their join time

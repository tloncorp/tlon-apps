# ops

These are optional config files for use with [bouncer](https://github.com/tloncorp/bouncer).

Note that the paths in the yml files and bin scripts will need to be updated for your system. TODO: make configurable :)

## Usage

### Sync the desk to a new fake ship

1. Create a fake ~zod
2. `bin/bounce`

Or if running multiple ships:

```sh
bin/bounce # defaults to bouncing ~zod on port 12321
bin/bounce -s net -p 12322
```

This will bounce `~net` running on port 12322

### Sync the desk after making changes

1. Start the fake ~zod
2. `bin/sync`

Or if running multiple ships:

```sh
bin/sync # defaults to syncing ~zod on port 12321
bin/sync -s net -p 12322
```

This will sync `~net` running on port 12322

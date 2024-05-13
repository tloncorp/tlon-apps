# UI Tests

The ui app contains a suite of automated e2e tests that run in CI and can be run locally.

The main test script is located in `rube/index.ts` and uses [Playwright](https://playwright.dev) to run.

The script:

1. fetches fake ships piers from GCS
2. downloads the urbit binaries for the local architecture
3. boots the test planets and sponsors
4. executes the tests against the current ui code version
5. kills spawned processes

Test specs are in the `e2e/` directory.

Each File can run in parallel, and they will while there are available workers.

Number of workers is configured in apps/tlon-web/playwright.config.ts

Specs in one file run in sequence.

## Running locally

After installing this project's dependencies with `pnpm install`,

```
npm run e2e
```

### Adding tests

Create a new spec file in the `e2e/` directory.

The file name should be descriptive of the test suite.

Add data-testid attributes to the components you want to test and accessthem using `page.getByTestId()`.

If the tests need preexisting conditions, such asgroups,channels or messages already present, the piers may need to be updated.

To do this, boot them manually, make the changes, exit, and then

1. `tar czvf rube-naldeg-mardev6.tgz naldeg-mardev` (or whatever the pier name is) from the parent folder
2. `gcloud storage cp ./rube-naldeg-mardev6.tgz gs://bootstrap.urbit.org`

### Debugging tests

```
npm run e2e:debug
```

Currently, tests utilize two fake planets, `~habduc-patbud` and `~naldeg-mardev`.

Their sponsoring fake galaxies `~zod` and `~bus` are also booted to enable packet routing between the ships.

The script will kill all processes on exit.

In some cases though, such as when debugging if a playwright assertion fails, http processes may be left running causing Vite to fail to start the next time.

If this happens, find the processes with `ps aux | grep localhost` or `lsof -Pi :3001 -sTCP:LISTEN` (and `3000`) and kill from cmd line.

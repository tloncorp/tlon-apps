# UI Tests

The ui app contains a suite of automated e2e tests that run in CI and can be run locally.

The main test script is located in `rube/index.ts` and uses [Playwright](https://playwright.dev) to run.

The script:

1. fetches fake ships piers from GCS
2. downlaods the urbit binaries for the local architecture
3. boots the ships
4. executes the tests against the current ui code version
5. kills spawned processes

Test specs are in the `e2e/` directory.

## Running locally

After installing  this project's dependencies with `npm install`,

```
npx playwright install
```

Then, to run all the tests:

```
npm run rube
```

### Debugging tests

```
npm run rube:debug
```

Currently, tests utilize two fake ships, `~zod` and `~bus`.


To debug only tests from one of the ships, use for example 


```
npm run e2e:debug:bus
```

The script will kill all processes on exit, but in some cases a localhost may be left running and generate an error when trying to run again. If this happens, find it with `ps aux | grep localhost` and kill from cmd line.
# Spill

A react-native testbed for experimental interface

## Known issues

- May not update
- Random import failures in dev mode

## Gotchas

- Use 'as const' when defining tamagui variants to ensure typing will be correct
- Sometimes Xcode fails to build with a fabric related error -- rerunning pod install usually fixes this
- After modifying .svgrrc, restart the react native bundler with the --reset-cache flag to get it to pick up changes
- Press events do not bubble. Press is handled by the deepest child component pressed that has `pressStyle`, `onPress`, or `onLongPress` set (other properties might trigger this too?) and won't trigger style or event changes on parent elements. To change the style of multiple components on press, use [styled context](https://tamagui.dev/docs/core/styled#createstyledcontext) or one of [these methods](https://tamagui.dev/docs/intro/props#parent-based-styling).
- Seems like Tamagui babel plugin can be kind of fragile -- introducing react-native-dotenv to babel config broke press styles somehow.
- Passing a Realm.List of strings (probably other primitive values too) to a query filter will cause an error.
- Realm's caching is wonky
  - Normal indexed access is correctly cached, but using map, etc. produces uncached results.

## Icons

- Icons are svg files exported directly from figma
- We're using `react-native-svg-transformer` to allow us to import them directly
- Transform can be configured in `.svgrrc`
- `assets/icons/index.ts` will need to be updated manually if icon filenames change

## Debugging Realm

- You can use Realm studio to inspect the state of the Realm DB. Download it [here](https://www.mongodb.com/docs/realm/studio/), then log out the `path` value of the main realm instance (returned by `useRealm`). Open that file with realm studio to browse all records. Easiest way on osx is just to run `open ${filename}.realm` at the command line.

## Configuration

This repo uses `babel-plugin-transform-inline-environment-variables` for configuration. The plugin allows you to pass environment variables through to the js side.

- You must specify what enviroment variables will be transferred in `babel.config.js`.
- The plugin only transforms for static references to variables. `process.env.APP_ENV` will work, but `process.env[appEnvVariable]` will note.
- I also tried using `react-native-dotenv` and `react-native-config`. `react-native-dotenv` (weirdly) broke press styled on tamagui. Something to do with the interaction between the dotenv and tamagui babel plugins. `react-native-config` has a configuration system linked to XCode schemas, which would have been more of a hassle to manage.

## Open questions

- When do we use undefined vs null?

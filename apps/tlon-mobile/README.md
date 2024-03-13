# tlon-mobile

Tlon mobile app including React Native-based wrapper around Groups

## Local Development

### Prerequisites

-   Node.js v20+
-   Android device with developer mode enabled or Android Studio with emulator
-   iOS device with Apple developer account enabled or Mac device with iPhone Simulator
-   [SwiftFormat](https://github.com/nicklockwood/SwiftFormat)
-   JDK 18

### Setup

Check out the repo and install dependencies:

```sh
npm install
```

Create an `.env` file based on the provided `.env.sample` file and fill in environment variables:

```sh
cp .env.sample .env
```

To use the staging server, which requires basic auth, fill the `API_AUTH_USERNAME` and `API_AUTH_PASSWORD` variables to the local .env file.

```
API_AUTH_USERNAME=...
API_AUTH_PASSWORD=...
```

Create a `local.properties` file in the `android` folder and set your Android SDK path in it:

```sh
sdk.dir = /Users/<user>/Library/Android/sdk
```

Create a keystore file for Android

```sh
cd android/app
keytool -genkey -v -keystore debug.keystore -storepass android -alias androiddebugkey -keypass android -keyalg RSA -keysize 2048 -validity 10000
```

Install [SwiftForamt](https://github.com/nicklockwood/SwiftFormat) for auto-formatting Swift code:

```sh
brew install swiftformat
```

Start development mode, which includes an attached code generation process to update Tailwind CSS classes during development:

```sh
npm run dev
```

Plug in your Android device or start the Android emulator and run the application in development mode:

```sh
npm run android
```

Plug in your iOS device or start the iPhone Simulator and run the application in development mode:

```sh
npm run ios
```

## Debugging

### Dev tools

Press `j` while running expo-cli/metro to open chrome devtools. You can use the devtools to view logs, network requests, and more. [More info here](https://docs.expo.dev/debugging/tools/#debugging-with-chrome-devtools).

### Default Credentials

To streamline testing the login flow, you can use env variables to prepopulate fields in the Tlon Login and ship login screen. The relevant variables are:

```
DEFAULT_TLON_LOGIN_EMAIL=
DEFAULT_TLON_LOGIN_PASSWORD=
DEFAULT_SHIP_LOGIN_URL=
DEFAULT_SHIP_LOGIN_ACCESS_CODE=
```

See `.env.sample` for other configurable env variables.

## Deployment

Deployment is handled by [Expo Application Services](https://expo.dev/eas).

-   Create new production builds by pushing a new release tag (e.g., `v1.0.0`) or manually running the `Build Apps [Production]` action.
-   Push an OTA code update to the production channel by merging to the `main` branch or manually running the `Push Updates [Production]` action.

### Production build

-   Update version and build numbers
    -   [./app.config.ts](./app.config.ts)
        -   `ios.runtimeVersion`: update using [semantic versioning](https://semver.org/) if you are creating a new app version
        -   `ios.buildNumber`: always increment when creating a new build. App Store Connect will reject a build upload if its build number already exists on a previous build.
        -   `android.runtimeVersion`: keep in sync with `ios.runtimeVersion`
        -   `android.versionCode`: keep in sync with `ios.buildNumber`
    -   [./android/build.gradle](./android/build.gradle)
        -   `android.defaultConfig.versionCode`: keep in sync with `android.versionCode` from `app.config.ts`
        -   `android.defaultConfig.versionName`: keep in sync with `android.runtimeVersion` from `app.config.ts`
    -   [./ios/Landscape.xcodeproj/project.pbxproj](./ios/Landscape.xcodeproj/project.pbxproj)
        -   `Debug.buildSettings.CURRENT_PROJECT_VERSION`: keep in sync with `ios.buildNumber` from `app.config.ts`
        -   `Release.buildSettings.CURRENT_PROJECT_VERSION`: keep in sync with `ios.buildNumber` from `app.config.ts`
        -   `Debug.buildSettings.MARKETING_VERSION`: keep in sync with `ios.runtimeVersion` from `app.config.ts`
        -   `Release.buildSettings.MARKETING_VERSION`: keep in sync with `ios.runtimeVersion` from `app.config.ts`
-   Create and push git tag
    -   Trigger the `Build Apps [Production]` workflow by creating and pushing any tag that starts with `v`. For consistency, this tag should be in the format `<ios.runtimeVersion>b<ios.buildNumber>` (e.g., `v3.1.3b44`).

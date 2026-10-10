# Settings and account

What every row on the Settings tab does (appearance, privacy, app info, bug reports, experimental features), plus signing up, logging in and out, managing a Tlon account, and the screens the app shows when a node, login or app version needs attention.

## What's on the Settings screen
<!-- src: packages/app/ui/components/SettingsScreenView.tsx, packages/app/features/settings/SettingsScreen.tsx, packages/app/navigation/desktop/SettingsNavigator.tsx -->
<!-- covers: route:Settings -->

Phone: tap the gear in the tab bar. Under `App` the rows are, in order: `Your profile`, `Contacts`, `Notifications`, `Appearance`, `Manage Tlon account`, `Privacy`, `Blocked users`, `App info`, `Tlon Messenger on the Web`, `Report a bug`, `Experimental features` and `Log out`.
Desktop: click the gear at the bottom of the left rail. The list is shorter: `Notifications`, `Appearance`, `Privacy`, `Blocked users`, `App info`, `Report a bug` and `Experimental features`. Each opens in the pane beside the list.
Notes: `Notifications` and `Appearance` show their current choice under the name. `Your profile` opens your profile, `Contacts` your contact list, `Notifications` your notification level, and `Blocked users` the people you've blocked. `Manage Tlon account` and `Tlon Messenger on the Web` only show on hosted accounts.

## Why is a Settings row missing for me
<!-- src: packages/app/ui/components/SettingsScreenView.tsx, packages/app/features/settings/SettingsScreen.tsx, packages/app/navigation/desktop/SettingsNavigator.tsx, packages/app/features/settings/bot/BotSettingsSections.tsx, apps/tlon-web/src/logic/useMedia.ts -->

Who: `Manage Tlon account` and `Tlon Messenger on the Web` are for accounts Tlon hosts, and neither shows in the desktop layout. A self-hosted node gets neither.
Notes: with a hosted Tlonbot, the phone puts the bot's own settings (`Models`, `Connections` and more) above `App`. If the app can't use your hosted login just then, for example because it has expired, you get a single `Bot Settings` row instead. On desktop a hosted bot always gets the single `Bot Settings` row, which opens the bot's settings in a new browser tab. No hosted bot means no bot rows at all. Desktop also leaves out `Your profile`, `Contacts` and `Log out`. A browser window under 768 pixels wide gets the phone layout instead, which still has no `Log out`.

## Set my status from the Settings tab
<!-- src: packages/app/features/settings/SettingsScreen.tsx, packages/app/ui/components/SettingsScreenView.tsx, packages/app/ui/components/ProfileStatusSheet.tsx -->

Phone: on the Settings tab, press and hold `Your profile`. A sheet opens with an `Update your status` box. Type up to 50 characters and tap the arrow button to save.
Notes: this is a phone shortcut. Desktop's Settings has no `Your profile` row.

## Change the theme or turn on dark mode
<!-- src: packages/app/features/settings/ThemeScreen.tsx, packages/app/features/settings/themeOptions.ts, packages/app/ui/components/SettingsScreenView.tsx, packages/shared/src/store/settingsActions.ts -->
<!-- covers: route:Theme -->

Phone: Settings tab, then `Appearance`. Under `Theme`, tap one of `Auto`, `Tlon Light`, `Tlon Dark`, `Dracula`, `Greenscreen`, `Gruvbox`, `Monokai`, `Nord`, `Peony` or `Solarized`.
Desktop: the gear in the left rail, then `Appearance`.
Notes: `Auto` follows your device's light or dark setting (`Uses your system appearance`). For dark mode pick `Tlon Dark`, or leave it on `Auto` with the device set to dark. The choice is saved to your node, not just to this device. There is no setting for text size.

## Show or hide placeholders for deleted messages
<!-- src: packages/app/features/settings/ThemeScreen.tsx, packages/app/ui/components/SettingsScreenView.tsx -->

Phone: Settings tab, then `Appearance`. Under `Messages`, switch `Show deleted messages` on or off.
Desktop: the gear in the left rail, then `Appearance`.
Notes: when it's on, a deleted message leaves a marker where it used to be (`Show a placeholder for deleted messages`). It starts off.

## Find the app version or my node's software version
<!-- src: packages/app/features/settings/AppInfoScreen.tsx, packages/app/ui/components/AppSetting.tsx, packages/app/ui/components/SettingsScreenView.tsx -->
<!-- covers: route:AppInfo -->

Phone: Settings tab, then `App info`. It lists `Build version`, `Notify provider`, `Notify service`, `Desk version`, `Desk source`, `Desk hash` and `Permitted Scheduler ID`. Tap a row to copy its value; the copy icon turns into a checkmark.
Desktop: the gear in the left rail, then `App info`.
Notes: `Build version` is the app's build on this phone. The three `Desk` rows describe the Tlon Messenger software installed on your node: its version, where it gets updates from, and its hash. If they can't be read you see `Cannot load app info settings`. Your node's name is not on this screen, and there is no clear-cache or reset button.

## Turn on developer logs and send them to Tlon
<!-- src: packages/app/features/settings/AppInfoScreen.tsx, packages/app/constants.ts, packages/app/features/settings/PrivacyScreen.tsx -->

Phone: Settings tab, then `App info`. Switch on `Enable Developer Logs` and tap `OK` on the `Debug mode enabled` notice. Close the app fully, reopen it and repeat the problem. Go back to `App info` and tap the "Upload logs" button, which shows a count. The logs go to Tlon's reporting service, and your mail app opens a message to support@tlon.io with your ID and app details already filled in; describe the problem and send it.
Notes: the email does not contain the logs, and the upload may not go out if `Share Usage Statistics` is off, so describe the problem in the email too. Logs can slow the app, so switch them off afterwards. The button only appears once some logs have been captured. With no mail app, the screen shows the log ID so you can email it yourself.

## Export the app's local database
<!-- src: packages/app/features/settings/AppInfoScreen.tsx, packages/app/lib/downloadDb.native.ts, packages/app/lib/downloadDb.ts -->

Phone: Settings tab, then `App info`, then `Export DB` at the bottom. On iPhone the share sheet opens so you can save or send the file. On Android you pick a folder and the file is saved there.
Desktop: there is no `Export DB` button.
Notes: the file is a copy of what the app keeps on this phone, named with the date and time. It is for troubleshooting. It is not an export of your node: the app has no button for exporting a node or its recovery keys.

## Stop sharing usage statistics with Tlon
<!-- src: packages/app/features/settings/PrivacyScreen.tsx, packages/app/ui/components/SettingsScreenView.tsx, packages/shared/src/store/settingsActions.ts, apps/tlon-mobile/src/screens/Onboarding/SetTelemetryScreen.tsx -->
<!-- covers: route:PrivacySettings -->

Phone: Settings tab, then `Privacy`. On the `Privacy Settings` screen, switch off `Share Usage Statistics`.
Desktop: the gear in the left rail, then `Privacy`.
Notes: the screen describes sharing as helping Tlon improve the app (`By sharing, you help us improve the app for everyone.`). The choice is saved to your node, not just to this device. Self-hosted logins on the phone are also asked once, right after connecting, on a `Usage Statistics` screen with an `Enable anonymous usage stats` switch.

## Stop people finding me by my phone number
<!-- src: packages/app/features/settings/PrivacyScreen.tsx, packages/shared/src/store/dbHooks.ts -->

Phone: Settings tab, then `Privacy`, then switch off `Phone number discovery`.
Desktop: the gear in the left rail, then `Privacy`.
Who: the switch only appears once you have a verified phone number on your account.
Notes: while it's on, friends who already have your number can find you on Tlon Messenger. Switching it off hides you from that lookup. It does not remove the number from your account.

## Hide nicknames or avatars
<!-- src: packages/app/features/settings/PrivacyScreen.tsx -->

Phone: Settings tab, then `Privacy`. Switch on `Hide Nicknames` to see real node names instead of the nicknames people chose. Switch on `Hide Avatars` to hide avatar images throughout the app.
Desktop: the gear in the left rail, then `Privacy`.
Notes: these are your own viewing preferences. They don't change what other people see.

## Stop link previews from using Tlon's service
<!-- src: packages/app/features/settings/PrivacyScreen.tsx, packages/shared/src/store/metagrabActions.ts -->

Phone: Settings tab, then `Privacy`, then switch on `Disable Tlon helpers`.
Desktop: the gear in the left rail, then `Privacy`.
Notes: your node always tries to build link previews itself. With the switch off, the app asks Tlon's service for a preview when your node can't make a good one. With it on, the app skips that backup request, so some links may show a plainer preview or none.

## Manage my Tlon account
<!-- src: packages/app/features/settings/ManageAccountScreen.tsx, packages/app/ui/components/SettingsScreenView.tsx, packages/app/features/settings/SettingsScreen.tsx, packages/app/navigation/desktop/SettingsNavigator.tsx -->
<!-- covers: route:ManageAccount -->

Phone: Settings tab, then `Manage Tlon account`. Tlon's account page opens inside the app under the title `Manage account`. Tap the back arrow to return.
Desktop: the row isn't shown. The page it opens lives at tlon.network/account.
Who: people logged in to the phone app with a Tlon-hosted account. A self-hosted node has no Tlon account to manage.
Notes: what you can do there is decided by Tlon's website; the app only displays the page. If your hosted login has expired you get `Logout Required` with `Cancel` and `Logout`. Log out, log back in, then try again.

## Delete my account
<!-- src: packages/app/features/settings/ManageAccountScreen.tsx, packages/app/ui/components/SettingsScreenView.tsx, packages/api/src/client/hostingApi.ts -->
<!-- absent: delete account -->

Phone: the app has no delete button of its own. The closest thing is `Manage Tlon account` on the Settings tab, which shows Tlon's account page inside the app. What that page offers is up to Tlon's website, so look there. When you tap back, the app checks your account and logs you out if it can no longer find it.
Who: hosted accounts only. A self-hosted node isn't a Tlon account, so the app has nothing to delete for it.
Notes: logging out is not deleting. `Log out` only clears the app on that phone.

## Report a bug
<!-- src: packages/app/features/settings/UserBugReportScreen.tsx, packages/app/ui/components/SettingsScreenView.tsx -->
<!-- covers: route:WompWomp -->

Phone: Settings tab, then `Report a bug`. If you like, type what happened in `Additional notes` (the box says `What went wrong?`, 300 characters at most), then tap `Send Report`. You'll see `Bug report sent`.
Desktop: the gear in the left rail, then `Report a bug`.
Notes: the screen says diagnostic information is attached automatically. What you type is kept on the phone and is not part of the report, so the team learns that something went wrong, not what. To explain it, email support@tlon.io. A report is one-way: nothing more happens in the app, so use it to flag a problem, not to ask a question.

## Send feedback by shaking the phone
<!-- src: apps/tlon-mobile/src/hooks/usePoorUxShakeReport.tsx, apps/tlon-mobile/src/components/AuthenticatedApp.tsx, packages/app/features/settings/PrivacyScreen.tsx -->

Phone: shake the phone a few times while the app is open. A `Report Poor UX` box appears. Type in the `What went wrong?` field and tap `Submit`, or tap `Cancel` to close it.
Notes: phone only, and only once you're logged in. Submitting reports your note together with whether the app was syncing at that moment. Like usage reports, it may not be sent if `Share Usage Statistics` is off. If the box pops up by accident, tap `Cancel` or anywhere outside it.

## Email Tlon support from the app
<!-- src: packages/app/ui/components/EmailSupportLink.tsx, packages/app/constants.ts, apps/tlon-mobile/src/screens/Onboarding/GettingNodeReadyScreen.tsx, apps/tlon-mobile/src/screens/Onboarding/UnderMaintenance.tsx, packages/app/features/DeskOutdatedScreen.tsx, apps/tlon-mobile/src/App.main.tsx, packages/app/ui/components/SettingsScreenView.tsx -->

Phone: Settings has no support row. An email link shows up on the screens where the app is stuck: while your node is waking up, when the app says you're offline, when it says your ship needs an update, and on `Needs Repair` as an `Email Support` button. Tap it and your mail app opens a message to support@tlon.io.
Notes: if the phone has no mail app, the links show `No mail app found` with the address to write to. The `Email Support` button on `Needs Repair` has no such message, so write to support@tlon.io yourself.

## Turn on an experimental feature
<!-- src: packages/app/features/settings/FeatureFlagScreen.tsx, packages/app/ui/components/FeatureFlagScreenView.tsx, packages/app/lib/featureFlags.ts, packages/app/ui/components/SettingsScreenView.tsx -->
<!-- covers: route:FeatureFlags -->

Phone: Settings tab, then `Experimental features`. Flip the switch beside the one you want: `Enable collecting and reporting performance data` or `Enable Buckets channels`. Below the switches are two text boxes, `Context lens gateway URL` and `Context lens gateway token`.
Desktop: the gear in the left rail, then `Experimental features`.
Who: everyone can open the screen. `Enable Markdown mode for notebook posts` is only listed for Tlon staff.
Notes: every switch starts off. They are saved on the device you set them on, not to your node, so set them again on each device.

## Turn performance data reporting on or off
<!-- src: packages/app/lib/featureFlags.ts, packages/app/utils/perf.tsx, apps/tlon-mobile/src/App.main.tsx, packages/app/ui/components/SettingsScreenView.tsx, packages/app/features/settings/PrivacyScreen.tsx -->
<!-- covers: flag:instrumentationEnabled -->

Phone: Settings tab, then `Experimental features`, then the switch `Enable collecting and reporting performance data`.
Notes: it starts off. While it's on, the phone app measures how long things take and reports those measurements. It is separate from `Share Usage Statistics` on the Privacy screen. The switch is also listed on desktop, but only the phone app collects this data.

## Log out
<!-- src: packages/app/ui/components/SettingsScreenView.tsx, packages/app/hooks/useHandleLogout.native.ts -->
<!-- absent: switch account -->

Phone: Settings tab, scroll to the bottom and tap `Log out`. A `Log out from Tlon` prompt asks `Are you sure you want to log out?`. Tap `Log out now`, or `Cancel` to stay.
Desktop: Settings has no `Log out` row, in the browser or in the desktop app.
Notes: logging out clears your saved login and the copy of your chats kept on that phone. It does not delete your account, and nothing is removed from your node, so your chats load again when you log back in. The app holds one account at a time: to use a different one, log out first.

## Log out when the app is stuck on a waiting or setup screen
<!-- src: apps/tlon-mobile/src/screens/Onboarding/GettingNodeReadyScreen.tsx, apps/tlon-mobile/src/screens/Onboarding/UnderMaintenance.tsx, apps/tlon-mobile/src/screens/HostingAuthReconnectScreen.tsx, packages/app/features/DeskOutdatedScreen.tsx, packages/app/ui/components/Channel/ChannelHeader.tsx, packages/app/navigation/topLevelTabs.ts, apps/tlon-web/src/app.tsx -->

Phone: these screens carry their own `Log out` at the top: the node waking-up screen, `Needs Repair`, `Security check` and `Update your ship`. During first-time setup with your bot the Settings tab is locked, so open the three-dot menu at the top of the chat and tap `Log out` there.
Desktop: `Update your ship` has `Log out` in the desktop app but not in the browser.

## Why are the other tabs locked right after I sign up
<!-- src: packages/app/navigation/topLevelTabs.ts, packages/app/navigation/OnboardingStartupScreen.tsx, packages/app/hooks/useAgentGroupOnboardingLock.ts, packages/shared/src/db/keyValue.ts, packages/app/ui/components/Channel/ChannelHeader.tsx -->
<!-- covers: route:OnboardingStartup -->

Phone: at the start of first-time setup with your bot, only the Bot tab responds. Workspaces, Activity and Settings don't open yet. If you close the app during that stretch, it reopens in the same setup chat so you can carry on.
Notes: this is expected, not a frozen app. The lock lifts when your bot accepts your setup choices, and it also has a safety timeout of about 30 seconds, so it should never last long. To leave before then, the three-dot menu at the top of the chat has `Log out`.

## Sign up for a new account
<!-- src: apps/tlon-mobile/src/screens/Onboarding/WelcomeScreen.tsx, apps/tlon-mobile/src/screens/Onboarding/SignupScreen.tsx, apps/tlon-mobile/src/screens/Onboarding/CheckOTPScreen.tsx, apps/tlon-web/src/app.tsx -->

Phone: open the app and tap `Sign up`. Enter your phone number and tap `Sign up` again. A 6-digit code arrives by text; type it on the `Confirm Code` screen and the app moves on by itself. To use email, tap the "sign up with an email address" link under the button and you get the code by email.
Desktop: there is no sign-up on desktop or the web. Sign up in the phone app first.
Notes: signing up creates a Tlon-hosted account. If the number or email is already registered, a message says an account already exists; log in instead. Signing up means agreeing to the `Terms of Service` linked under the button.

## Join with an invite link or code
<!-- src: apps/tlon-mobile/src/screens/Onboarding/WelcomeScreen.tsx, apps/tlon-mobile/src/screens/Onboarding/PasteInviteLinkScreen.tsx, apps/tlon-mobile/src/screens/Onboarding/SignupScreen.tsx, packages/app/ui/components/Onboarding/OnboardingInvite.tsx -->

Phone: on the first screen tap `Join with an invite`. On `Have an invite?`, type the link or code into `Invite code or link`, or tap `Paste`. Once the app recognises it you land on a sign-up screen titled `Accept invite`; finish signing up there. If you opened the app from an invite link, the first screen already shows the invite with a `Join with new account` button.
Notes: the invite card reads `Sent you a personal invite` for a personal invite, or names the group for a group invite. An invite the app can't match shows `No invite found`. You don't need an invite to sign up.

## I didn't get my code, or it says the code is wrong
<!-- src: apps/tlon-mobile/src/screens/Onboarding/CheckOTPScreen.tsx, packages/app/ui/components/Form/OTPInput.tsx -->

Phone: on the code screen, tap `Request a new code` under the boxes. Type the six digits; the app submits them as soon as the last one is in.
Notes: `Confirmation code is incorrect or expired.` means ask for a new one. `Must wait before requesting another code.` means you asked too recently; wait a little and try again. The line above the boxes says whether to check your phone or your email. To switch between the two, go back one screen.

## What sign-up asks after the code
<!-- src: apps/tlon-mobile/src/screens/Onboarding/SetNicknameScreen.tsx, apps/tlon-mobile/src/screens/Onboarding/SetNotificationsScreen.tsx, apps/tlon-mobile/src/screens/Onboarding/AllowNotificationsScreen.tsx, apps/tlon-mobile/src/screens/Onboarding/ReserveShipScreen.tsx -->

Phone: three short steps. `Nickname`: type the name people will see (30 characters at most) and tap `Next`. `Notifications`: pick how much you want to be notified and tap `Next`, then tap `Next` once more and choose Allow when the phone asks. Then a `We're setting you up` screen works through `Preparing your Tlon computer`, `Connecting to the network` and `Setting up your Tlonbot`, and ends on `Setup complete!`.
Notes: you can't go back during these steps. The notifications screen says you can change that choice any time; it lives under `Notifications` in Settings afterwards.

## Sign-up sent me to a waitlist
<!-- src: apps/tlon-mobile/src/screens/Onboarding/SignupScreen.tsx, apps/tlon-mobile/src/screens/Onboarding/CheckOTPScreen.tsx, apps/tlon-mobile/src/screens/Onboarding/JoinWaitListScreen.tsx -->

Phone: when Tlon has no room for new hosted accounts, sign-up opens `Join Waitlist` instead. Enter your email and tap `Submit`. You'll see `You have been added to the waitlist.`
Notes: the screen says `We'll let you know as soon as space is available.` There is nothing else to do in the app until then.

## Sign-up or login asks me to confirm a phone number
<!-- src: apps/tlon-mobile/src/screens/Onboarding/RequestPhoneVerifyScreen.tsx, apps/tlon-mobile/src/screens/Onboarding/CheckVerifyScreen.tsx, apps/tlon-mobile/src/hooks/useOnboardingHelpers.ts -->

Phone: some accounts get one extra check. On the `Confirm` screen, enter a phone number and tap `Next`. Type the code that's texted to you on the `Confirm code` screen. `Request a new code` sends another.
Notes: the screen explains it as making sure you're a person. It appears when Tlon's hosting marks the account as needing verification, at sign-up or at login. If you see `Invalid phone number, please contact support@tlon.io`, email that address.

## Log in to my hosted account on the phone
<!-- src: apps/tlon-mobile/src/screens/Onboarding/WelcomeScreen.tsx, apps/tlon-mobile/src/screens/Onboarding/TlonLogin.tsx, apps/tlon-mobile/src/screens/Onboarding/CheckOTPScreen.tsx -->

Phone: on the first screen tap `Have an account? Log in`, then `Log in with phone number` or `Log in with email`. Enter it, tap `Send code to log in`, and type the 6-digit code you receive.
Notes: use whichever one is on your account. The login screen has links to switch: `Normally log in with email?` and `Log in with phone number instead`. `There is no account associated with this email.` or `There's no phone number associated with this account.` means that email or number isn't on an account. Logging in means agreeing to the `Terms of Service` linked on the screen.

## Log in with a password instead of a code
<!-- src: apps/tlon-mobile/src/screens/Onboarding/WelcomeScreen.tsx, apps/tlon-mobile/src/screens/Onboarding/TlonLogin.tsx, apps/tlon-mobile/src/screens/Onboarding/TlonLoginLegacy.tsx -->

Phone: tap `Have an account? Log in`, then `Log in with email`. Under the button tap `Or, log in with a password`. Fill in `Email` and `Password` and tap `Submit` at the top right.
Notes: this only works if your account has a password. `Incorrect email or password.` means one of them is wrong. `Show` and `Hide` in the password box reveal or mask what you typed. Phone-number logins have no password option; they always use a code.

## Reset my password
<!-- src: apps/tlon-mobile/src/screens/Onboarding/WelcomeScreen.tsx, apps/tlon-mobile/src/screens/Onboarding/TlonLogin.tsx, apps/tlon-mobile/src/screens/Onboarding/TlonLoginLegacy.tsx, apps/tlon-mobile/src/screens/Onboarding/ResetPasswordScreen.tsx -->
<!-- absent: change password -->

Phone: from the first screen tap `Have an account? Log in`, `Log in with email`, then `Or, log in with a password`. Tap `Forgot password?`. On `Reset Password`, enter your account email and tap `Submit`. Tlon emails you a link to set a new password.
Notes: the app returns to the login screen without a confirmation message, so check your inbox. You have to be logged out to do this: there is no screen for changing a password once you're in the app. Logging in with an emailed code needs no password at all.

## Log in to a self-hosted node on the phone
<!-- src: apps/tlon-mobile/src/screens/Onboarding/WelcomeScreen.tsx, apps/tlon-mobile/src/screens/Onboarding/ShipLoginScreen.tsx, apps/tlon-mobile/src/screens/Onboarding/SetTelemetryScreen.tsx, packages/app/constants.ts -->

Phone: on the first screen tap `Have an account? Log in`, then `Or configure self hosted`. On `Connect Ship`, put your node's web address in `Ship URL` and its code in `Access Code`, then tap `Connect`. A `Usage Statistics` screen follows: leave `Enable anonymous usage stats` off or switch it on, then tap `Next`.
Notes: the access code is four groups of six letters with hyphens between them. `Sorry, we couldn't log in to your ship. It may be busy or offline.` means the login didn't go through; check the address and code. A Tlon-hosted address is refused with `Please log in to your hosted Tlon ship using email and password.` Use the hosted login for those.

## The app says my node is waking up
<!-- src: apps/tlon-mobile/src/screens/Onboarding/GettingNodeReadyScreen.tsx, packages/app/ui/components/StoppedNodePushSheet.tsx, apps/tlon-mobile/src/hooks/useCheckNodeStopped.ts, packages/app/ui/components/EmailSupportLink.tsx -->

Phone: just wait. The screen says `Your P2P node is waking up after a deep sleep.` and moves through `Pulling out of storage`, `Running boot sequence`, `Establishing a connection` and `Your node is ready`, then opens the app by itself.
Who: hosted accounts, when Tlon's hosting reports the node as paused or suspended. It can appear at login or while you're using the app.
Notes: the screen says it usually takes a minute to a few minutes. You can close the app meanwhile; it sends a notification when the node is ready. If notifications aren't allowed yet, a sheet offers `Notify me when it's ready`. After about 20 seconds a `Need help? Email` link to support appears.

## The app says my node needs repair
<!-- src: apps/tlon-mobile/src/screens/Onboarding/UnderMaintenance.tsx, packages/app/constants.ts -->

Phone: `Needs Repair` means Tlon's hosting has your node under maintenance and it can't be started yet. Tap `Check Again` to see whether it's back. After a check, an `Email Support` button appears; it opens a message to support@tlon.io.
Who: hosted accounts.
Notes: the screen says Tlon's support team has already been alerted. When the node is back, `Check Again` moves you on to the waking-up screen and then into the app. `Log out` is at the top left.

## The app asks for a security check code
<!-- src: apps/tlon-mobile/src/screens/HostingAuthReconnectScreen.tsx, apps/tlon-mobile/src/components/AuthenticatedApp.tsx -->

Phone: your Tlon login needs refreshing. The `Security check` screen, headed `Let's make sure it's you`, sends a 6-digit code to the phone number or email on your account. Type it in; `Confirm code` submits it. `Request a new code` sends another after a short countdown.
Who: hosted accounts, when the app finds that its hosted login has expired.
Notes: you stay signed in, and the app carries on once the code is accepted. `Confirmation code is incorrect or expired.` means ask for a new one. `Log out` at the top left is there if you'd rather sign in from scratch.

## The app says my ship needs an update
<!-- src: packages/app/features/DeskOutdatedScreen.tsx, apps/tlon-mobile/src/components/AuthenticatedApp.tsx, apps/tlon-web/src/app.tsx -->

Phone: `Update your ship` means the Tlon software on your node is older than this app needs. On a hosted account Tlon runs the update for you: wait a few minutes and tap `Try again`. On a self-hosted node, tap `How to update` for instructions, update the node, then tap `Try again`.
Desktop: the same screen can appear in the browser and in the desktop app.
Notes: the screen shows the version it needs and the one your node reports. The rest of the app stays hidden until the node is up to date. A `Still stuck? Email` link opens a message to support.

## The app says I'm offline
<!-- src: apps/tlon-mobile/src/App.main.tsx, apps/tlon-mobile/src/hooks/useTopLevelRouting.ts, packages/app/ui/components/EmailSupportLink.tsx -->

Phone: `You are offline. Please connect to the internet and try again.` shows when the phone reports no network connection. Reconnect to Wi-Fi or mobile data and the app comes back by itself.
Notes: if you're online again and still see it, tap the `Back online and still stuck? Email` link to write to support.

## I was logged out with a "Session Expired" message
<!-- src: packages/app/hooks/useConfigureUrbitClient.ts, packages/api/src/client/urbit.ts -->

Phone: `Session Expired` means your node refused the login the app had saved. Tap `Logout`, then log in again.
Notes: the message says this can happen after a factory reset of the node. On a self-hosted node the app can also log you out without any message when the node stops accepting its saved login. Log in again with the node's address and its current access code.

## Log in on the desktop app
<!-- src: apps/tlon-web/src/components/DesktopLoginScreen.tsx, apps/tlon-web/src/app.tsx -->

Desktop: the desktop app opens on `Connect to Your Ship`. Put your node's web address in `Ship URL` and its code in `Access Code`, then click `Connect`. The app keeps the login, so later launches go straight in.
Notes: this is the only login the desktop app has. It offers no phone-number or email login and no sign-up. `Sorry, we couldn't log in to your ship. It may be busy or offline.` means the login didn't go through; check the address and the code.

## Log in on the web
<!-- src: apps/tlon-web/src/app.tsx, packages/app/ui/components/WebAppSplashSheet.tsx, packages/app/features/settings/SettingsScreen.tsx, packages/app/ui/components/SettingsScreenView.tsx -->

Desktop: in a browser, Tlon Messenger is served by your own node and has no login screen of its own. If you open it without being logged in to the node, the browser is sent to your node's address, where the node asks you to log in. Log in there and open Tlon Messenger again.
Notes: on a hosted account the way in is Tlon's login page, tlon.network/login. On the phone, `Tlon Messenger on the Web` in Settings opens that page in your browser.

## The app showed a "Tlon Messenger is on the web" sheet
<!-- src: packages/app/ui/components/WebAppSplashSheet.tsx, apps/tlon-mobile/src/components/AuthenticatedApp.tsx, packages/shared/src/store/settingsActions.ts, packages/app/ui/components/SettingsScreenView.tsx -->

Phone: this sheet, titled `Tlon Messenger is on the web`, appears the second time you open the app after logging in. `Visit tlon.io` opens Tlon's web login page in your browser. `Not now` closes it.
Notes: either button, or swiping the sheet away, dismisses it for good. The dismissal is saved to your node, so it won't come back on another phone. To reach the web version later, hosted accounts have `Tlon Messenger on the Web` in Settings.

## Close the "Get Tlon for iOS and Android" box on desktop
<!-- src: packages/app/ui/components/MobileAppPromoBanner.tsx, packages/app/navigation/desktop/HomeSidebar.tsx, packages/shared/src/store/settingsActions.ts -->

Desktop: the `Get Tlon for iOS and Android` box sits at the bottom of the `Home` sidebar. Click the X in its corner to close it. `App Store` and `Play Store` open the phone app's store pages in a new tab.
Notes: closing it is saved to your node, so it stays gone after a reload and on other computers.

## The app says an update is required
<!-- src: packages/app/features/RequiredUpdateScreen.tsx, packages/app/hooks/useRequiredUpdate.ts, apps/tlon-mobile/src/App.main.tsx -->

Phone: `Update Required` means this version of the app is too old to keep working. Tap the button, which reads "View in App Store" on iPhone and "View in Play Store" on Android, install the update, then open the app again.
Notes: there is no way to skip it. Every other screen is hidden until you update. The app rechecks the minimum version about every ten minutes, so this can appear while you're using it.

## Update Tlon Messenger on desktop
<!-- src: packages/app/navigation/desktop/TopLevelDrawer.tsx, apps/tlon-web/src/logic/useAppUpdates.ts -->

Desktop: when a newer version is ready, a yellow button with a starburst icon appears in the left rail, under your avatar. Click it and the page reloads on the new version.
Notes: there is nothing to download or install. No yellow button means the app hasn't found a newer version.

## Use my own storage for pictures and files
<!-- src: packages/shared/src/store/storage/storageUtils.ts, packages/app/ui/components/Form/inputs.tsx -->
<!-- absent: S3 endpoint, secret access key -->

Notes: Tlon Messenger has no screen for storage settings, on the phone or on desktop. It uses whatever storage your node already has set up: Tlon's on a hosted account, or your own S3-compatible storage if that was configured on the node outside the app. When the node has no storage at all, image pickers such as the one for a group's icon are greyed out and read `Storage not configured`.

# Tlonbot in the app

Where your Tlonbot lives in the app and how to change it: the Bot tab, first-run setup, bot settings (name, models, API keys, subscriptions, connected services, permissions, channel rules), bot runs, approval cards, reply ratings and the Bot badge. The bot settings screens are in the phone app; desktop opens a web page instead.

## Where is my Tlonbot in the app?
<!-- src: packages/app/navigation/TopLevelTabNavigator.native.tsx, packages/app/hooks/useBotDmTab.ts, packages/app/navigation/desktop/TopLevelDrawer.tsx -->
<!-- covers: route:BotChat -->

Phone: the Bot tab is the first icon in the bottom bar. It shows your bot's avatar, or the bot's generated pattern if it has no avatar; a small flower shape stands in until the bot's profile loads. Tap it to open your private chat with your bot. A dot under the icon means the bot sent something you haven't read.
Desktop: in a wide window there is no Bot tab; your chat with the bot is a DM in the sidebar. A narrow window has the Bot tab.
Who: hosted accounts with a Tlonbot.
Notes: the app normally opens on the Bot tab. Without a hosted bot the tab is not there and the app opens on Workspaces.

## Why can't I leave the Bot tab right after signing up?
<!-- src: packages/app/navigation/topLevelTabs.ts, packages/app/hooks/useAgentGroupOnboardingLock.ts, packages/app/navigation/TopLevelTabNavigator.native.tsx, packages/shared/src/db/keyValue.ts, packages/app/features/top/useAgentOnboardingChannel.ts, packages/app/features/top/ChannelScreen.tsx, packages/app/ui/components/Channel/ChannelHeader.tsx -->

Phone: while your bot asks its first setup questions, the app keeps you in that chat. The Workspaces, Activity and Settings tabs can't be selected and going back does nothing. The lock lifts as soon as the bot accepts your answers, or about 30 seconds after the chat opens, whichever comes first.
Notes: while locked, the three-dot icon at the top right of the chat has `Log out`. If you close and reopen the app during the lock, it reopens in the same chat.

## What happens the first time I open the app with a Tlonbot?
<!-- src: packages/app/ui/components/Wayfinding/AgentOnboarding/AgentOnboardingSequence.tsx, apps/tlon-mobile/src/App.main.tsx, packages/app/ui/components/Wayfinding/botName.ts, packages/app/features/top/useAgentOnboardingFirstEntry.ts -->

Phone: after signup a loading screen reads `Opening your Tlonbot chat...`, then you land in the Bot tab. Setup happens in the chat: the bot asks questions and you tap your answers. While it writes its first post, a status line shows messages such as `Writing your first entry…`.
Desktop: this runs in the phone app only.
Who: hosted accounts with a Tlonbot.
Notes: the app does not ask you to name the bot, pick an avatar or choose a model here. If you have a nickname, the bot is named after you automatically, as "<your nickname>'s Tlonbot 🌱". Change the name or model later in bot settings. If the chat isn't ready within about two minutes, the app shows its step-by-step setup screens instead.

## Set up my bot step by step (name, avatar, model)
<!-- src: packages/app/ui/components/Wayfinding/SplashSequence.tsx, packages/app/ui/components/Wayfinding/botProviderOptions.ts, apps/tlon-mobile/src/components/TlonbotRevivalPromptSheet.tsx, apps/tlon-mobile/src/App.main.tsx, packages/app/hooks/useShowWebSplashModal.ts -->

Phone: tap `Configure now`. Type a name (50 characters at most) and tap `Next`. Tap `Upload photo` for an avatar, or `Skip`. Then pick what powers the bot: the included model, or a provider marked `Requires API key`. For a key provider, paste the key, tap `Next`, choose a model and tap `Save`.
Desktop: this runs in the phone app only.
Who: only after tapping `Begin Setup` on the `Ready for Tlonbot?` prompt, or when the usual first-run chat setup could not start.
Notes: the included model needs no key and skips the model step. In the signup fallback the screens start with `Let's get started`, and the list can also offer `ChatGPT subscription`. To connect a Claude or Grok subscription, use bot settings later.

## What is the "Ready for Tlonbot?" prompt?
<!-- src: apps/tlon-mobile/src/components/TlonbotRevivalPromptSheet.tsx, packages/app/ui/components/Wayfinding/TlonBotSetupPaneView.tsx, packages/app/ui/components/Wayfinding/SplashSequence.tsx -->

Phone: a sheet titled `Ready for Tlonbot?` slides up when you open the app. Tap `Begin Setup` to name your bot, give it an avatar and choose a model. Then a `Setting up your Tlonbot...` screen shows while the bot is prepared. It says you can leave the app and you'll get a notification when the bot is ready. Tap `Not now` to skip.
Who: hosted accounts that Tlon has marked as ready for a bot and that don't have one yet. Phone app only.
Notes: after `Not now` the prompt stays away until the app is restarted. The waiting screen has `Log out` at the top left.

## Open my bot's settings
<!-- src: packages/app/features/settings/SettingsScreen.tsx, packages/app/ui/components/SettingsScreenView.tsx, packages/app/features/settings/bot/BotSettingsSections.tsx, packages/app/features/settings/BotSettingsAreaScreens.tsx, packages/app/ui/components/UserProfileScreenView.tsx, packages/app/features/top/UserProfileScreen.tsx, packages/app/utils/botSettings.ts, packages/app/navigation/desktop/SettingsNavigator.tsx -->
<!-- covers: route:BotSettings, route:BotModels, route:BotConnections -->

Phone: open the Settings tab (the gear). Your bot's card sits under your profile: its name, with `Bot profile` under it, then `Models`, `Connections`, `Permissions` and, when your node can show them, `Scheduled tasks`. Or open the Bot tab, tap the bot's name at the top, and tap `Bot settings` on its profile.
Desktop: click the gear icon in the left rail, then `Bot Settings`. That opens Tlon's bot settings page (tlon.network/tlonbot) in a new browser tab. The bot settings screens in this file are in the phone app only.
Who: hosted accounts with a Tlonbot.
Notes: on a self-hosted node there are no bot rows in Settings.

## Is my bot online?
<!-- src: packages/app/features/settings/bot/BotSettingsUI.tsx, packages/app/features/settings/bot/BotSettingsSections.tsx, packages/app/ui/components/UserProfileScreenView.tsx -->

Phone: open the Settings tab. Under your bot's card is the footer `Tlonbot is starting. Settings may take a moment to become editable.` while the bot is starting. To check the bot itself, open its profile: the `Node` tile reads `Online` or `Offline`.
Desktop: not in the desktop app.
Who: hosted accounts with a Tlonbot.
Notes: the card has no online badge of its own. Until the bot's settings have loaded, the apply bar is disabled, so changes can't be applied yet.

## Save changes to bot settings
<!-- src: packages/app/features/settings/bot/BotSettingsUI.tsx, packages/app/features/settings/bot/BotSettingsSections.tsx, packages/app/features/settings/bot/useBotSettingsDraft.ts, packages/app/features/settings/bot/botSettingsDraftHelpers.ts, packages/app/features/settings/BotSettingsScreen.tsx, packages/app/features/settings/BotIdentitySettingsScreen.tsx -->

Phone: changes to the bot's name, models, permissions and channel rules are not saved as you make them. Each changed row gets a `Pending` badge, and a bar appears at the bottom with `Discard` and a button such as "Apply 2 Changes". Tap it, then `Apply & restart` on the `Restart gateway?` prompt.
Desktop: not in the desktop app.
Who: hosted accounts with a Tlonbot.
Notes: the prompt says the bot restarts and will be offline for about 20 seconds. The bar shows on the Settings tab, the profile's `Bot settings` screen, and the `Models`, `Connections`, `Permissions` and `Identity` screens, so go back to one of those to apply. API keys, subscriptions and connected services save straight away. A failure shows in red above the buttons.

## Change my bot's name
<!-- src: packages/app/features/settings/BotIdentitySettingsScreen.tsx, packages/app/features/settings/bot/BotSettingsSections.tsx, packages/app/ui/components/SettingsScreenView.tsx -->
<!-- covers: route:BotIdentitySettings -->

Phone: on the Settings tab, tap the bot's name at the top of its card (`Bot profile` is under it). Type the new name in the `Nickname` box and tap done on the keyboard. Then apply the change with the button at the bottom.
Desktop: not in the desktop app. `Settings` → `Bot Settings` opens Tlon's bot settings web page instead.
Who: hosted accounts with a Tlonbot.
Notes: the name must be shorter than 64 characters. This screen has the name and nothing else: bot settings have no control for the bot's avatar, bio or status. Your own name is set separately, under `Your profile`.

## Change the AI model my bot uses
<!-- src: packages/app/features/settings/BotModelSettingsScreen.tsx, packages/app/features/settings/bot/modelPicker.ts, packages/app/features/settings/bot/BotSettingsSections.tsx, packages/app/features/settings/bot/constants.ts, packages/app/features/settings/bot/helpers.ts, packages/app/features/settings/bot/useBotSettingsData.ts, packages/app/ui/components/SettingsScreenView.tsx -->
<!-- covers: route:BotModelSettings -->

Phone: on the Settings tab, tap `Models` in your bot's card, then `Default model`. The list has a section for each provider. Tap a model to pick it; the screen closes by itself, then apply.
Desktop: not in the desktop app. `Settings` → `Bot Settings` opens Tlon's bot settings web page instead.
Who: hosted accounts with a Tlonbot.
Notes: only what your bot can use is listed: the included Basic model under `Included with Tlon`, plus any provider with a saved API key or a connected subscription. A provider with many models shows five, with `See all` and the count under them. Use `Search models` to find a model. Some models show a price, and some carry a `Recommended` or `ZDR` label. Tapping the included model when it is already your bot's model changes nothing.

## Set fallback models
<!-- src: packages/app/features/settings/BotModelSettingsScreen.tsx, packages/app/features/settings/bot/BotSettingsSections.tsx, packages/app/ui/components/SettingsScreenView.tsx -->

Phone: on the Settings tab, tap `Models` in your bot's card, then `Fallback models`. Under `Available models`, tap each model you want. It gets a checkmark and joins the numbered `Fallback chain` at the top. Tap `Remove` beside one to take it out. Tap `Done`, then apply.
Desktop: not in the desktop app. `Settings` → `Bot Settings` opens Tlon's bot settings web page instead.
Who: hosted accounts with a Tlonbot.
Notes: if the default model fails, the bot tries these in order. The order is the order you added them; you can't drag to reorder. On the included Basic model with none chosen, the row reads `Managed by Tlon`.

## Turn on zero data retention
<!-- src: packages/app/features/settings/bot/BotSettingsSections.tsx, packages/app/features/settings/BotModelSettingsScreen.tsx, packages/app/ui/components/SettingsScreenView.tsx -->

Phone: on the Settings tab, tap `Models` in your bot's card, then switch on `Zero data retention` and apply.
Desktop: not in the desktop app. `Settings` → `Bot Settings` opens Tlon's bot settings web page instead.
Who: hosted accounts with a Tlonbot. The switch only shows while the default model is the included Basic model.
Notes: the switch's text reads `Zero data retention avoids model providers that retain data. It may use your included credits faster.` With OpenRouter the same switch sits at the top of its section in the default model list instead, where it narrows the list to models tagged `ZDR`.

## Add an API key for a model provider
<!-- src: packages/app/features/settings/BotProviderListSettingsScreen.tsx, packages/app/features/settings/BotApiKeySettingsScreen.tsx, packages/app/features/settings/bot/constants.ts, packages/app/features/settings/bot/helpers.ts, packages/app/features/settings/bot/BotSettingsSections.tsx, packages/app/ui/components/SettingsScreenView.tsx -->
<!-- covers: route:BotProviderListSettings, route:BotApiKeySettings -->

Phone: on the Settings tab, in your bot's card tap `Connections`, then `API keys`, then the provider: `Anthropic`, `OpenAI`, `OpenRouter` or `xAI (Grok)`. Paste the key into `API key` and tap `Save key`.
Desktop: not in the desktop app. `Settings` → `Bot Settings` opens Tlon's bot settings web page instead.
Who: hosted accounts with a Tlonbot.
Notes: the key saves straight away, and that provider then appears when you choose a model. The eye icon shows what you typed. Afterwards only the last four characters are shown. Keys in the wrong shape are refused: OpenAI keys start with "sk-", OpenRouter with "sk-or-", Anthropic with "sk-ant-" or "anthropic-".

## Replace or remove an API key
<!-- src: packages/app/features/settings/BotApiKeySettingsScreen.tsx, packages/app/features/settings/BotProviderListSettingsScreen.tsx, packages/app/features/settings/bot/BotSettingsSections.tsx, packages/app/ui/components/SettingsScreenView.tsx -->

Phone: on the Settings tab, in your bot's card tap `Connections`, then `API keys`, then the provider. To replace the key, type the new one where it says `Enter replacement key` and tap `Save key`. To remove it, tap `Remove key`, then `Remove`.
Desktop: not in the desktop app. `Settings` → `Bot Settings` opens Tlon's bot settings web page instead.
Who: hosted accounts with a Tlonbot.
Notes: the confirmation says `Tlonbot will stop using custom models from this provider.` Both changes are saved straight away, with no apply step. The full key is never shown again, only its last four characters.

## Connect my ChatGPT subscription
<!-- src: packages/app/features/settings/BotOpenAISubscriptionScreen.tsx, packages/app/ui/components/LLMSubscriptionAuthView.tsx, packages/app/features/settings/BotProviderListSettingsScreen.tsx, packages/app/features/settings/bot/constants.ts, packages/app/features/settings/bot/openAiSubscription.ts, packages/app/features/settings/bot/BotSettingsSections.tsx, packages/app/ui/components/SettingsScreenView.tsx, packages/app/features/settings/BotModelSettingsScreen.tsx -->
<!-- covers: route:BotOpenAISubscription -->

Phone: on the Settings tab, in your bot's card tap `Connections`, then `Provider subscriptions`, then `ChatGPT`, then the connect button. A `One-time code` appears; tap it to copy. Tap the button that opens OpenAI's sign-in page, sign in and enter the code. Back in the app you'll see `Connected. Loading your models…`, then the model list. Under `OpenAI`, tap a model, then apply.
Desktop: not in the desktop app. `Settings` → `Bot Settings` opens Tlon's bot settings web page instead.
Who: hosted accounts with a Tlonbot. The rows are greyed out until the bot is online.
Notes: if the code runs out you'll see `This connection attempt expired.` and `Try again`. A row reading `Unavailable` means the app couldn't check the subscription; open it and tap `Try again`.

## Connect a Claude or Grok subscription
<!-- src: packages/app/features/settings/BotOpenAISubscriptionScreen.tsx, packages/app/ui/components/LLMSubscriptionAuthView.tsx, packages/app/features/settings/BotProviderListSettingsScreen.tsx, packages/app/features/settings/bot/constants.ts, packages/app/features/settings/bot/BotSettingsSections.tsx, packages/app/ui/components/SettingsScreenView.tsx, packages/app/features/settings/BotModelSettingsScreen.tsx -->

Phone: on the Settings tab, in your bot's card tap `Connections`, then `Provider subscriptions`, then `Claude` or `Grok`, then the connect button. Grok works like ChatGPT: copy the `One-time code` and enter it on the sign-in page. Claude is different: on a computer with Claude Code installed, run `claude setup-token`, paste the result into `Paste setup token` and tap `Connect`.
Desktop: not in the desktop app. `Settings` → `Bot Settings` opens Tlon's bot settings web page instead.
Who: hosted accounts with a Tlonbot.
Notes: once connected, the model list opens. Tap a model under `Anthropic` for Claude or `xAI (Grok)` for Grok, then apply.

## Disconnect a subscription
<!-- src: packages/app/features/settings/BotOpenAISubscriptionScreen.tsx, packages/app/features/settings/BotProviderListSettingsScreen.tsx, packages/app/features/settings/bot/BotSettingsSections.tsx, packages/app/ui/components/SettingsScreenView.tsx -->

Phone: on the Settings tab, in your bot's card tap `Connections`, then `Provider subscriptions`, then the one marked `Active`. Tap `Disconnect subscription`, then `Disconnect`.
Desktop: not in the desktop app. `Settings` → `Bot Settings` opens Tlon's bot settings web page instead.
Who: hosted accounts with a Tlonbot.
Notes: the confirmation says `Tlonbot will no longer be able to use models from this subscription.` The same screen has a `Choose model` button.

## Can I use an API key and a subscription for the same provider?
<!-- src: packages/app/features/settings/BotApiKeySettingsScreen.tsx, packages/app/features/settings/BotOpenAISubscriptionScreen.tsx, packages/app/features/settings/bot/openAiSubscription.ts, packages/app/features/settings/bot/constants.ts -->

Phone: no. For OpenAI, Anthropic and xAI the bot holds one or the other. If you connect a subscription while a key is saved, the app asks first; tap `Replace and connect` and the key is removed once the subscription connects. If you save a key while a subscription is connected, tap `Replace and save` and the subscription is disconnected.
Desktop: not in the desktop app.
Who: hosted accounts with a Tlonbot.
Notes: OpenRouter has no subscription option, only a key. Keys and subscriptions for different providers can sit side by side.

## Connect an outside service to my bot
<!-- src: packages/app/features/settings/BotMcpSettingsScreen.tsx, packages/app/ui/components/BotSettingsScreenView.tsx, packages/app/features/settings/bot/BotSettingsSections.tsx, packages/app/lib/mcpProviders.ts, packages/app/features/settings/openOAuthUrl.ts, packages/app/ui/components/SettingsScreenView.tsx -->
<!-- covers: route:BotMcpSettings -->
<!-- absent: custom mcp, custom server -->

Phone: on the Settings tab, in your bot's card tap `Connections`, then `Connected services`. On the `Connect MCP` screen, tap a service under `Available`. Your browser opens so you can sign in and approve access. Back in the app it sits under `Connected` with an `Active` badge.
Desktop: not in the desktop app. `Settings` → `Bot Settings` opens Tlon's bot settings web page instead.
Who: hosted accounts with a Tlonbot.
Notes: Tlon sets which services are listed. You can't add your own server or paste a token; every service connects by signing in. There is no apply step. The refresh icon at the top right reloads the list. `OAuth setup is unavailable for this ship.` means nothing can be connected right now.

## Disconnect a service from my bot
<!-- src: packages/app/features/settings/BotMcpSettingsScreen.tsx, packages/app/ui/components/BotSettingsScreenView.tsx, packages/app/features/settings/bot/BotSettingsSections.tsx, packages/app/ui/components/SettingsScreenView.tsx -->

Phone: on the Settings tab, in your bot's card tap `Connections`, then `Connected services`. Tap the service under `Connected`, then `Disconnect`.
Desktop: not in the desktop app. `Settings` → `Bot Settings` opens Tlon's bot settings web page instead.
Who: hosted accounts with a Tlonbot.
Notes: you'll see `Connection disconnected.` and the service moves back under `Available`. The bot can no longer use it.

## Choose who can DM my bot
<!-- src: packages/app/features/settings/BotPermissionsSettingsScreen.tsx, packages/app/features/settings/BotShipListSettingsScreen.tsx, packages/app/ui/components/ShipPickerSheet.tsx, packages/app/features/settings/bot/BotSettingsSections.tsx, packages/app/ui/components/SettingsScreenView.tsx -->
<!-- covers: route:BotPermissionsSettings, route:BotShipListSettings -->

Phone: on the Settings tab, tap `Permissions`, then `DM allowlist`. Tap the plus at the top right, then pick a contact or type any username. To take someone off, tap their row, which is marked `Remove`. Go back to `Permissions` and apply.
Desktop: not in the desktop app. `Settings` → `Bot Settings` opens Tlon's bot settings web page instead.
Who: hosted accounts with a Tlonbot.
Notes: the app says `Users on the allowlist can DM Tlonbot directly.` Someone already on the list can't be picked a second time.

## Turn auto-accept DM invites or auto-discover channels on or off
<!-- src: packages/app/features/settings/BotPermissionsSettingsScreen.tsx, packages/app/features/settings/bot/BotSettingsSections.tsx, packages/app/ui/components/SettingsScreenView.tsx -->

Phone: on the Settings tab, tap `Permissions`. Under `Who can message Tlonbot` are two switches. `Auto-accept DM invites` is described as `From users on the allowlist`. `Auto-discover group channels` is described as `Index new channels you join`. Flip one, then apply.
Desktop: not in the desktop app. `Settings` → `Bot Settings` opens Tlon's bot settings web page instead.
Who: hosted accounts with a Tlonbot.

## Let certain people always use my bot
<!-- src: packages/app/features/settings/BotPermissionsSettingsScreen.tsx, packages/app/features/settings/BotShipListSettingsScreen.tsx, packages/app/features/settings/BotChannelRuleSettingsScreen.tsx, packages/app/features/settings/bot/BotSettingsSections.tsx, packages/app/ui/components/SettingsScreenView.tsx -->

Phone: on the Settings tab, tap `Permissions`, then `Default authorized`. Tap the plus at the top right and pick a contact or type a username. Go back to `Permissions` and apply.
Desktop: not in the desktop app. `Settings` → `Bot Settings` opens Tlon's bot settings web page instead.
Who: hosted accounts with a Tlonbot.
Notes: the app says `These users can always interact with Tlonbot, regardless of per-channel rules.` When you switch the bot on in a new channel, that channel's allowed list starts as a copy of this one.

## Choose who can invite my bot to groups
<!-- src: packages/app/features/settings/BotPermissionsSettingsScreen.tsx, packages/app/features/settings/BotShipListSettingsScreen.tsx, packages/app/features/settings/bot/BotSettingsSections.tsx, packages/app/ui/components/SettingsScreenView.tsx -->

Phone: on the Settings tab, tap `Permissions`, then `Can invite to groups`. Tap the plus at the top right and pick a contact or type a username. Tap a row marked `Remove` to take that person off. Go back to `Permissions` and apply.
Desktop: not in the desktop app. `Settings` → `Bot Settings` opens Tlon's bot settings web page instead.
Who: hosted accounts with a Tlonbot.
Notes: the app says `These users can invite Tlonbot to groups.`

## Choose which channels my bot responds in
<!-- src: packages/app/features/settings/BotChannelRulesScreen.tsx, packages/app/features/settings/BotPermissionsSettingsScreen.tsx, packages/app/features/settings/bot/BotSettingsSections.tsx, packages/app/ui/components/SettingsScreenView.tsx -->
<!-- covers: route:BotChannelRulesSettings -->

Phone: on the Settings tab, tap `Permissions`, then `Per-channel rules`. The `Channel rules` screen lists your channels by group, each marked `Off`, `Open` or `Allowlist`. Search with `Filter by name`, or turn on `Enabled only` to see only channels where the bot is on. Tap a channel to change it, then go back to `Permissions` and apply.
Desktop: not in the desktop app. `Settings` → `Bot Settings` opens Tlon's bot settings web page instead.
Who: hosted accounts with a Tlonbot.
Notes: a group the bot is not in shows a `Join group` row. `Paused` means the bot has left that group.

## Turn my bot on or off in one channel
<!-- src: packages/app/features/settings/BotChannelRuleSettingsScreen.tsx, packages/app/features/settings/BotChannelRulesScreen.tsx, packages/app/features/settings/BotPermissionsSettingsScreen.tsx -->
<!-- covers: route:BotChannelRuleSettings -->

Phone: on `Channel rules`, tap the channel and flip `Enable Tlonbot here`. Under `Access mode` pick `Open` (`Anyone in the channel can chat`) or `Allowlist only` (`Authorized users only`). For an allowlist, type a username such as ~sampel-palnet and tap `Add`; tap the X beside a name to remove it. Tap `Done`, then apply from `Permissions`.
Desktop: not in the desktop app.
Who: hosted accounts with a Tlonbot.
Notes: a newly enabled channel starts as `Allowlist only`, holding a copy of the people you always allow. `Reset to defaults` puts it back to that. The switch stays off until the bot has joined the group.

## Use a different model in one channel
<!-- src: packages/app/features/settings/BotChannelRuleSettingsScreen.tsx, packages/app/features/settings/BotChannelRulesScreen.tsx, packages/app/features/settings/BotPermissionsSettingsScreen.tsx -->

Phone: on `Channel rules`, tap a channel where the bot is enabled. Under `Model`, tap `Custom model`, pick a provider, then search for and tap a model. `Default model` goes back to the bot's usual one. Tap `Done`, then apply from `Permissions`.
Desktop: not in the desktop app.
Who: hosted accounts with a Tlonbot that has a saved API key or a connected subscription. Without one the option is greyed out and reads `Add an API key in Bot settings to use a custom model here.`
Notes: in the channel list the row then shows the provider beside its access mode.

## Add my bot to a group from channel rules
<!-- src: packages/app/features/settings/BotChannelRulesScreen.tsx, packages/app/features/settings/BotChannelRuleSettingsScreen.tsx -->

Phone: on `Channel rules`, find the group and tap `Join group` in its section, then `Join` to confirm. The row reads `Joining…` while it works. Once the bot is in, tap a channel and enable it.
Desktop: not in the desktop app.
Who: hosted accounts with a Tlonbot.
Notes: the confirmation says `This adds your Tlonbot to the group. After it joins, you can choose which channels it can respond in.` Until then a channel in that group reads `Join this group to enable Tlonbot in this channel.` If joining fails you'll see a message such as `Failed to join this group.`

## Turn my bot off in every channel at once
<!-- src: packages/app/features/settings/BotChannelRulesScreen.tsx, packages/app/features/settings/BotPermissionsSettingsScreen.tsx -->

Phone: on `Channel rules`, turn on `Enabled only`, then tap `Disable all channels`. Go back to `Permissions` and apply.
Desktop: not in the desktop app.
Who: hosted accounts with a Tlonbot.
Notes: `Undo` puts the channels back if you tap it before leaving the screen. This only changes group channels; it does not change who can DM the bot.

## Why does a channel say Paused?
<!-- src: packages/app/features/settings/BotChannelRulesScreen.tsx, packages/app/features/settings/BotChannelRuleSettingsScreen.tsx -->

Phone: the bot has left that group. On `Channel rules` the group shows `Tlonbot is no longer in this group` and its channels read `Paused`. Tap `Join group` to bring the bot back and resume the rules, or `Clear rules` to remove them, then apply.
Desktop: not in the desktop app.
Who: hosted accounts with a Tlonbot.
Notes: after `Clear rules` the button becomes `Undo` until you apply.

## See what my bot did to produce a reply
<!-- src: packages/app/ui/components/ChatMessage/ChatMessageActions/MessageActions.tsx, packages/app/ui/components/Channel/ContextLens/ContextLensButton.tsx, packages/app/ui/components/Channel/ContextLens/ContextLensRunSheet.tsx, packages/app/ui/components/Channel/ContextLens/RunSummary.tsx, packages/app/ui/components/Channel/ContextLens/RunInspector.tsx, packages/app/ui/components/Channel/ContextLens/CopyRawPayloadButton.tsx, packages/app/ui/components/Channel/ContextLens/lensPost.ts, packages/app/features/lens/ContextLensRunScreen.tsx, packages/app/ui/components/Channel/Scroller.tsx -->
<!-- covers: route:ContextLensRun -->

Phone: press and hold a reply from your bot and tap `View bot run`, or tap the small circled "i" under the reply. A `Bot run` sheet shows the outcome plus `Context`, `Run`, `Tools`, `Writes`, `Model` and `Runtime`. Tap `Expand` for the full view, which adds `Trigger`, `Output` and `Persistence` sections and a `Copy raw` button.
Desktop: hover the reply and open its three-dot menu for `View bot run`. It opens in a panel to the right of the chat.
Who: the bot's owner, on replies that carry run details.
Notes: a run that is no longer stored shows `Bot run unavailable`.

## See my bot's recent runs in a chat
<!-- src: packages/app/ui/components/Channel/ChannelHeader.tsx, packages/app/ui/components/Channel/index.tsx, packages/app/features/lens/ContextLensRunsScreen.tsx, packages/app/ui/components/Channel/ContextLens/useContextLensStore.ts, packages/app/ui/components/Channel/ContextLens/ContextLensPanel.tsx -->
<!-- covers: route:ContextLensRuns -->

Phone: open a chat your bot is in and tap the icon of two short horizontal lines at the top right. `Bot runs in this channel` lists each run with its status, time and a short preview. Tap one to open it.
Desktop: the same icon opens and closes a `Context Lens` panel beside the chat.
Who: the bot's owner. The icon shows in the bot's DM, or in a channel of a group the bot belongs to, once the app holds run records for that bot.
Notes: an empty list reads `No bot runs yet`. Notebooks don't have this icon.

## Ask my bot to try again after a reply failed
<!-- src: packages/app/ui/components/Channel/ContextLens/RunSummary.tsx, packages/app/ui/components/Channel/ContextLens/format.ts, packages/app/ui/components/Channel/ContextLens/ContextLensRunSheet.tsx, packages/app/ui/components/ChatMessage/ChatMessageActions/MessageActions.tsx -->

Phone: open the run: press and hold the bot's message and tap `View bot run`, or pick it from the list of runs in that chat. Tap `Retry` beside the status.
Desktop: `Retry` is in the panel that opens beside the chat.
Who: the bot's owner.
Notes: `Retry` only appears on runs that ended as `No reply`, `Timed out`, aborted or with an error. After a tap it reads `Retrying…` for a few seconds.

## Rate a reply from my bot
<!-- src: packages/app/ui/components/ChatMessage/BotFeedbackRow.tsx, packages/app/ui/components/ChatMessage/BotFeedbackSheet.tsx, packages/app/ui/components/ChatMessage/ChatMessage.tsx -->

Phone: under each reply from your bot are a thumbs-up and a thumbs-down. Tap one. A `Share feedback` sheet opens where you can switch between `Helpful` and `Not helpful`, tick reasons, add a note and tap `Send feedback`. Tap the same thumb again to clear your rating.
Desktop: the thumbs may only appear while you hover the reply.
Who: only on replies from your own hosted Tlonbot.
Notes: the sheet says `Your feedback and this thread are shared with Tlon.`

## Approve or block someone who wants to use my bot
<!-- src: packages/openclaw/src/monitor/approval.ts, packages/openclaw/src/monitor/index.ts, packages/app/ui/components/ChatMessage/StaticChatMessage.tsx, packages/app/ui/components/PostContent/A2UIBlock.tsx -->

Phone: the bot sends you a card in your DM with it, headed `DM access`, `Channel access` or `Group invite`. It names the person and may quote their message; `View message` jumps to it when it's there. Tap `Allow`, `Reject` or `Block`.
Who: the bot's owner.
Notes: tapping a button sends the matching command for you, such as `/allow <request-id>`, as a message in the chat. The button you tapped then greys out. You can still type the commands yourself; `/pending` lists open requests.

## Answer a card or buttons my bot sends in chat
<!-- src: packages/app/ui/components/PostContent/A2UIBlock.tsx, packages/app/ui/components/ChatMessage/StaticChatMessage.tsx, packages/app/ui/components/PostContent/McpConnectControl.tsx, packages/app/hooks/useA2UINavigation.ts -->

Phone: some bot messages show as a card with buttons, choices or a list of services. Tap a button or a choice to answer. Your answer is posted in the chat as a message from you, and the control then greys out so it can't be sent twice.
Desktop: the same, except that a service that isn't connected opens Tlon's bot settings web page.
Who: cards show in one-to-one DMs. In a group channel only the group's host sees them, and only on messages from that workspace's bot. Everyone else sees a plain-text version.
Notes: on a card that lists services, connected ones can be ticked for that workspace. Tapping one that isn't connected opens the screen to connect it.

## How do I tell that an account is a bot?
<!-- src: packages/app/ui/components/BotBadge.tsx, packages/app/ui/components/UserProfileScreenView.tsx, packages/app/ui/components/AuthorRow.tsx, packages/shared/src/domain/botIdentity.ts, packages/shared/src/domain/botLiveness.ts -->

Phone: bots carry a small `Bot` badge beside their name: on their messages, on their profile, and in member lists, contact lists and the @-mention picker. `Bot · Offline` means the bot has reported that it is not running.
Notes: the badge shows for Tlon-hosted bots and for any account that declares itself a bot. It is the account's own claim, not something Tlon checks.

## What's on my bot's profile?
<!-- src: packages/app/ui/components/UserProfileScreenView.tsx, packages/app/features/top/UserProfileScreen.tsx, packages/app/ui/components/BotBadge.tsx, packages/app/ui/components/Channel/ChannelHeader.tsx, packages/app/utils/botSettings.ts, packages/app/ui/components/BotSystemPrompts.tsx -->

Phone: in the Bot tab, tap the bot's name at the top. The profile shows its avatar, its name with a `Bot` badge, and its username (tap to copy). Below are `Message`, `Add Contact` or `Remove Contact`, and `Block` on a bot that is not yours, then on your own bot a `Bot settings` row and a `Scheduled tasks` row with a count. Then its `Status` and `About` text if it has any, and `Node` and `Sponsor` tiles showing whether it can be reached.
Desktop: `Bot settings` on the profile opens Tlon's bot settings web page.
Who: the `Bot settings` and `Scheduled tasks` rows only show on your own bot's profile. Your own bot has no `Block` button.

## Edit my bot's instructions or personality
<!-- src: packages/app/ui/components/BotSystemPrompts.tsx, packages/app/ui/components/UserProfileScreenView.tsx, packages/app/features/top/UserProfileScreen.tsx -->

Phone: in the Bot tab, tap the bot's name at the top and scroll down to `Bot behavior`. Tap a prompt: `Instructions`, `Personality`, `Tools`, `Identity`, `About you` or `Bootstrap`. Change the text and tap `Save changes`.
Who: the bot's owner, on a node that supports it. Nobody else sees the section.
Notes: saving a prompt briefly restarts your bot, and the sheet says so. A prompt can be 64 KB at most. `Preview` shows the text as it renders, and `Edit` goes back to the text. If the prompt is changed elsewhere while you are editing, the sheet shows the latest version and says so.

## See my bot's scheduled tasks
<!-- covers: route:ScheduledTasks -->
<!-- src: packages/app/features/automations/ScheduledTasksScreen.tsx, packages/app/ui/components/RecurringTasks.tsx, packages/app/ui/components/scheduledTaskSections.ts, packages/app/features/automations/useScheduledTasksEntry.ts, packages/app/ui/components/SettingsScreenView.tsx, packages/app/features/settings/SettingsScreen.tsx, packages/app/features/top/chatDetails.tsx -->

Phone: tap `Scheduled tasks` in your bot's card on the Settings tab, or on the bot's profile. In your DM with your bot, the clock icon at the top right opens them too. A group's or channel's info screen has a `Scheduled tasks` row too, which opens the tasks posting there. Each task shows its schedule, with `Paused` or `Paused for credits` before it when it is not running. Tap `New task` at the top right to add one.
Desktop: the same row sits under `Bot Settings` in the Settings list.
Who: the bot's owner for the Settings and profile rows. The group and channel rows appear when the bot has tasks there or could post there.
Notes: a group's or channel's list holds only the tasks that post there. If your node is too old, the list says `Scheduled tasks unavailable`. Until the bot has shared its tasks it says `Scheduled tasks not synced`, with `Refresh`.

## Add, edit, pause or delete a scheduled task
<!-- covers: route:ScheduledTaskEditor -->
<!-- src: packages/app/features/automations/ScheduledTaskEditorScreen.tsx, packages/app/ui/components/RecurringTasks.tsx, packages/app/ui/components/scheduledTaskSections.ts, packages/app/ui/components/automationTaskDraft.ts -->

Phone: to add one, tap `New task` on the list. Type a `Task name` and a `Task prompt`, set `Time` and the days under `Repeat`, and pick a channel under `Posts to`. Tap `Create`. To change one, open it, edit the fields and tap `Save`. For an existing task, `Active` pauses or restarts it. Tap `Delete task` at the bottom, then `Delete`, to remove it.
Who: the bot's owner.
Notes: a task started from a group's or channel's list posts there. The time shows the time zone it runs in. A paused-for-credits task can't be edited: the screen says `This task is paused while your credits are limited.` A task your bot made with its own schedule shows `Custom schedule`, and you change that by asking the bot. A task whose prompt the app can't change (a webhook, for example) greys out `Task prompt`, with `Ask your bot to change what this task does.` below it.

## Look at the browser my bot is using
<!-- src: packages/app/ui/components/PostContent/A2UIBlock.tsx, packages/app/features/browser/browserSessionLinkCard.ts, packages/api/src/client/browserSession.ts, packages/app/features/browser/BrowserViewerModal.tsx, packages/app/features/browser/BrowserViewerMenu.tsx, packages/app/features/browser/BrowserViewer.native.tsx -->

Phone: when the bot shares its browser, a card in your DM reads `Browser session` with `View and control the shared browser.` Tap `Open browser` on it. The browser opens in the app. The three-dot icon at the top right opens a menu with `Agent View`, `Mobile View` and `Show browser controls`. The one in use has a checkmark.
Who: only from a DM with your own bot.
Notes: the same trust rule as the sign-in form applies.

## Fill in a sign-in form for my bot's browser
<!-- src: packages/app/features/browser/BrowserCredentialHandoffScreen.tsx, packages/app/features/browser/browserHandoffTrust.ts, packages/app/hooks/useA2UINavigation.ts, packages/app/navigation/BasePathNavigator.tsx -->
<!-- covers: route:BrowserCredentialHandoff -->

Phone: when the bot's browser reaches a sign-in or details form, it sends a card in your DM with it. Tap the card's button to open `Secure browser form`. Fill in the fields and tap `Continue` for a sign-in, or `Fill fields` for other details. The app then returns you to the chat, and a message goes to the bot to carry on the task. If you finish in the live browser instead, tap `Return to conversation`.
Who: only from a DM with your own bot.
Notes: the screen says `These fields go directly to the live browser. They are never posted to chat or returned to the bot.` Filling in details does not submit a payment or place an order. `Open live browser` lets you finish any extra steps yourself.

## Ask Tlon for more credits when my bot pauses scheduled tasks
<!-- src: packages/openclaw/src/credit-increase-request.ts, packages/openclaw/src/cron-budget-hold.ts, packages/app/ui/components/ChatMessage/StaticChatMessage.tsx, packages/app/utils/creditIncreaseRequest.ts -->

Phone: when your token credits run low, the bot pauses your scheduled tasks and sends a message saying so, with a `Request credit increase` button. Tap it. The button changes to `Credit Increase Requested`.
Who: hosted accounts with a Tlonbot.
Notes: the request goes to Tlon and nothing is posted in the chat. If it can't be sent you'll see `Couldn't send the request. Please try again.`

## How do I know my bot is working on a reply?
<!-- src: packages/app/ui/components/Channel/useConversationComputingState.ts, packages/app/ui/components/Channel/ThinkingState.tsx, packages/app/ui/components/Channel/useShouldShowThinkingState.ts -->

Phone: while a bot is working, a line with a spinner appears at the bottom of the chat. It reads `Thinking...` unless the bot reports what it is doing. With two bots working it names both; with more it gives a count.
Notes: this shows in one-to-one DMs and in chat channels of groups only, not in group DMs. In a group chat the bot's avatar sits beside the line.

## Pick a slash command from a menu while typing
<!-- src: packages/shared/src/store/useBotSlashCommandManifest.ts, packages/shared/src/domain/slashCommands.ts, packages/app/ui/components/SlashCommandPopup.tsx, packages/app/ui/components/BareChatInput/useSlashCommands.ts -->

Phone: in a chat with a bot, type a slash as the first character of a message. A menu of commands appears and narrows as you keep typing. Tap one to put it in the message box, add anything it needs, and send.
Desktop: the arrow keys and Enter pick a command; Escape closes the menu.
Who: the menu shows in a DM with a bot, and in a group chat channel that has exactly one bot of yours as a member.
Notes: the phone shows up to 4 matches at a time and desktop up to 7. The menu includes commands such as `/model`, `/new`, `/pending` and `/allow`.

## What do I see if I self-host instead of using a hosted Tlonbot?
<!-- src: packages/app/hooks/useBotDmTab.ts, packages/app/features/settings/SettingsScreen.tsx, packages/app/ui/components/SettingsScreenView.tsx, packages/app/features/settings/BotSettingsScreen.tsx, packages/app/ui/components/ChatMessage/ChatMessage.tsx, packages/shared/src/store/useBotSlashCommandManifest.ts, packages/app/ui/components/BotBadge.tsx -->

Phone: there is no Bot tab, and the Settings tab has no bot card. The app opens on the Workspaces tab.
Notes: the bot settings screens work through Tlon's hosting, so the model, API key, subscription, connected service and permission screens are not available. Opened without a Tlon hosting login they show `Cannot access bot settings.` A bot you run yourself can still get the `Bot` badge, the slash-command menu in its DM, and run details on its replies. Thumbs-up and thumbs-down ratings are for hosted Tlonbots only.

## Why does bot settings say "Logout Required"?
<!-- src: packages/app/features/settings/BotSettingsScreen.tsx, packages/app/features/settings/BotMcpSettingsScreen.tsx, packages/app/features/settings/bot/useHostingSession.ts, packages/app/features/settings/SettingsScreen.tsx, packages/app/ui/components/SettingsScreenView.tsx -->

Phone: your Tlon account login on this phone has expired. The `Logout Required` alert offers `Logout` and `Cancel`. Tap `Logout`, log back in, and bot settings will load again.
Desktop: not in the desktop app.
Who: hosted accounts with a Tlonbot.
Notes: when this happens the Settings tab shows a single `Bot Settings` row where the bot sections usually are. Tapping it brings up the alert.

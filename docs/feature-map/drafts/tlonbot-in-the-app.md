# Tlonbot in the app

## Fill in a sign-in form for my bot's browser
<!-- src: packages/app/features/browser/BrowserCredentialHandoffScreen.tsx, packages/app/features/browser/browserHandoffTrust.ts, packages/app/hooks/useA2UINavigation.ts, packages/app/navigation/BasePathNavigator.tsx -->
<!-- covers: route:BrowserCredentialHandoff -->

Phone: when the bot's browser reaches a sign-in or details form, it sends a card in your DM with it. Tap the card's button to open `Secure browser form`. Fill in the fields and tap `Continue` for a sign-in, or `Fill fields` for other details. The app then returns you to the chat. If you finish in the live browser instead, tap `Return to conversation`.
Who: only from a DM with your own bot.
Notes: the screen says `These fields go directly to the live browser. They are never posted to chat or returned to the bot.` Filling in details does not submit a payment or place an order. `Open live browser` lets you finish any extra steps yourself.

## Ask Tlon for more credits when my bot pauses scheduled tasks
<!-- src: packages/openclaw/src/credit-increase-request.ts, packages/openclaw/src/cron-budget-hold.ts, packages/app/ui/components/ChatMessage/StaticChatMessage.tsx, packages/app/utils/creditIncreaseRequest.ts -->

Phone: when your token credits run low, the bot pauses your scheduled tasks and sends a message saying so, with a `Request credit increase` button. Tap it. The button changes to `Credit Increase Requested`.
Who: hosted accounts with a Tlonbot.
Notes: the request goes to Tlon and nothing is posted in the chat. If it can't be sent you'll see `Couldn't send the request. Please try again.`

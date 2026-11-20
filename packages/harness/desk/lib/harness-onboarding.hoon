::  First GUI open seeds ordinary durable chat, without inference or credentials.
::  The ship-wide marker survives deletion and reload; existing users keep
::  their conversations untouched. Gall serializes simultaneous first opens.
/-  h=harness, *harness-store
|%
++  message
  ^-  @t
  %+  rap  3
  :~  'Hi, I am your agent on this ship. Here is how to get started.\0a\0a'
      '### Connect a provider\0a\0a'
      'Open [Settings → Providers](#/settings?tab=providers), choose a provider, '
      'and add its API key or use the offered sign-in option. Then choose your '
      'provider and model in [Settings → Defaults](#/settings?tab=defaults). '
      'Start a new conversation to use those defaults. This welcome did not use any tokens.\0a\0a'
      '### Choose my tools\0a\0a'
      'In [Defaults](#/settings?tab=defaults), select the tools available to new conversations. '
      'Each conversation has its own settings; changing defaults does not rewrite existing chats. '
      'For external services, add a server in [Settings → MCP](#/settings?tab=mcp), '
      'then grant that server in the tools for the conversation that needs it.\0a\0a'
      '### Talk through Tlon\0a\0a'
      'Set a full-admin owner in [Settings → Peers](#/settings?tab=peers). '
      'A moon defaults to its actual sponsor; sibling-moon admins are optional. '
      'Open [Tlon](#/tlon), add any trusted ships and their resource grants, '
      'then enable replies and save. You can DM this ship; in group channels, mention it '
      'when mentions are required. Only permitted ships get replies.\0a\0a'
      '### Try asking me\0a\0a'
      '- “Search the web for news about Urbit and summarize the sources.”\0a'
      '- “Read this desk file and explain how it works.”\0a'
      '- “Find our earlier conversation about this project.”\0a'
      '- “What ships can you interact with?”\0a'
      '- In Tlon: “Remind me about this tomorrow.”\0a\0a'
      'What I can do depends on the tools you enable. Web search also needs a '
      '[search provider](#/settings?tab=search). '
      'Keep this chat as a reference, or delete it and start a new one whenever you like.'
  ==
++  ensure
  |=  saved=state-0
  ^-  [(unit session-id:h) state-0]
  ?:  !=(0 welcome-seen.saved)  [~ saved]
  =.  welcome-seen.saved  1
  ?:  !=(~ sessions.saved)  [~ saved]
  =/  ses=session:h
    [~[[%command-completed `@uv`0 'welcome' message] [%config-replaced defaults.saved(key '')]] 0]
  [`'welcome' saved(sessions (~(put by sessions.saved) 'welcome' ses))]
--

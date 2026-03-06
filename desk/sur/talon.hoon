/-  a=activity, c=channels
|%
+$  provider  ?(%openai %anthropic)
+$  rule  [mode=?(%open %restricted) allowed=(set ship)]
+$  config
  $:  provider=provider
      model=@t
      api-key=@t
      base-url=(unit @t)
      temperature=@ud
      max-tokens=@ud
      history-window=@ud
      max-log=(unit @ud)
      dm-allowlist=(set ship)
      group-channels=(set nest:c)
      channel-rules=(map nest:c rule)
      default-authorized=(set ship)
      prompt-files=(list @t)
  ==
+$  log-entry
  $:  role=?(%system %user %assistant %tool)
      author=@t
      time=@da
      content=@t
  ==
+$  reply-target
  $%  [%dm ship]
      [%channel nest=nest:c reply=(unit message-key:a)]
  ==
+$  tool-call
  $:  id=@t
      name=@t
      args=json
  ==
+$  inflight
  $:  id=@ud
      thread=@t
      reply=reply-target
      provider=provider
      model=@t
      system=@t
      messages=(list json)
      tools=json
  ==
+$  pending-http
  $:  inflight-id=@ud
      tool-id=@t
  ==
+$  state
  $:  config=config
      next-id=@ud
      threads=(map @t (list log-entry))
      inflight=(map @ud inflight)
      pending-http=(map @t pending-http)
  ==
+$  command
  $%  [%set-config =config]
      [%set-api-key provider=provider key=@t]
      [%set-model provider=provider model=@t base-url=(unit @t)]
      [%set-history window=@ud max-log=(unit @ud)]
      [%allow-dm =ship]
      [%remove-dm =ship]
      [%allow-channel nest=nest:c]
      [%remove-channel nest=nest:c]
      [%authorize-ship =ship]
      [%deauthorize-ship =ship]
      [%set-channel-rule channel=nest:c mode=?(%open %restricted) allowed=(list ship)]
      [%set-prompt-files files=(list @t)]
  ==
--

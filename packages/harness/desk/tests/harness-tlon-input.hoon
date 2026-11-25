/-  d=story, t=harness-tlon, a=activity-ver
/+  *test, input=harness-tlon-input, story=harness-tlon-story, cmd=harness-command,
    p=harness-tlon-policy
|%
++  test-leading-native-address-allows-shared-command-parser
  =/  source=story:d  ~[[%inline ~[[%ship ~lux] ' /remember project Keep it small.']]]
  =/  text  (text:input ~lux source)
  %-  expect
  !>  ?&  =('/remember project Keep it small.' text)
          =(`['remember' 'project Keep it small.'] (parse:cmd text))
      ==
++  test-leading-whitespace-and-split-plain-text
  =/  source=story:d  ~[[%inline ~[' ' [%ship ~lux] '  ' '/mem' 'ory']]]
  (expect-eq !>('/memory') !>((text:input ~lux source)))
++  test-other-ships-and-plain-spelling-are-not-address-tokens
  =/  other=story:d  ~[[%inline ~[[%ship ~nec] ' /forget project']]]
  =/  spelled=story:d  ~[[%inline ~['~lux /forget project']]]
  %-  expect
  !>  ?&  =((story-to-text:story other) (text:input ~lux other))
          =((story-to-text:story spelled) (text:input ~lux spelled))
      ==
++  test-prose-and-later-mentions-are-preserved
  =/  prose=story:d  ~[[%inline ~[[%ship ~lux] ' please remember this']]]
  =/  later=story:d  ~[[%inline ~['Example: ' [%ship ~lux] ' /forget project']]]
  %-  expect
  !>  ?&  =((story-to-text:story prose) (text:input ~lux prose))
          =((story-to-text:story later) (text:input ~lux later))
      ==
++  test-formatted-quoted-and-multi-paragraph-content-is-not-promoted
  =/  examples=(list story:d)
    :~  ~[[%inline ~[[%ship ~lux] ' ' [%inline-code '/forget project']]]]
        ~[[%inline ~[[%ship ~lux] ' ' [%blockquote ~['/forget project']]]]]
        ~[[%inline ~[[%ship ~lux] ' ' [%bold ~['/forget project']]]]]
        ~[[%inline ~[[%ship ~lux] ' /forget project']] [%inline ~['extra']]]
    ==
  (expect !>((levy examples |=(s=story:d =((story-to-text:story s) (text:input ~lux s))))))
++  test-paths-and-escapes-still-use-the-head-parser
  =/  path=story:d  ~[[%inline ~[[%ship ~lux] ' /tmp/file']]]
  =/  escaped=story:d  ~[[%inline ~[[%ship ~lux] ' //remember project no']]]
  (expect !>(&(=(~ (parse:cmd (text:input ~lux path))) =(~ (parse:cmd (text:input ~lux escaped))))))
++  test-address-normalization-never-grants-social-admission
  ::  The channel's own rule keeps the owner rule out of this.
  =/  =policy:t  [& `~nec ~ %mentions ~ (my ~[[[%chat ~nec %test] [%mentions |]]])]
  =/  event=$>(%post incoming-event:v8:a)
    :*  %post  [[~nec ~2026.9.6] ~2026.9.6]  [%chat ~nec %test]  [~nec %test]
        ~[[%inline ~[[%ship ~lux] ' /memory']]]  |
    ==
  =/  allowed  (normalize:p ~lux ~2026.9.6 policy event(mention &))
  ?>  ?=(^ allowed)
  %-  expect
  !>  ?&  =('/memory' text.u.allowed)  =(~ (normalize:p ~lux ~2026.9.6 policy event))
          =(~ (normalize:p ~lux ~2026.9.6 policy(enabled |) event(mention &)))
      ==
::  In a channel only one flat paragraph of plain text can carry a command.
::  Formatted text is stored with its speaker's prefix, so the head reads it
::  as words, and the prefix is never added twice.
::
++  owner-says
  |=  content=story:d
  ^-  (unit input:t)
  =/  =policy:t  [& `~nec ~ %mentions ~ ~]
  %:  normalize:p  ~lux  ~2026.9.6  policy
    [%post [[~nec ~2026.9.6] ~2026.9.6] [%chat ~nec %test] [~nec %test] content |]
  ==
++  observed
  |=  in=input:t
  ^-  @t
  ?^  (parse:cmd text.in)  text.in
  (attribute:input actor.in to.in text.in)
++  test-an-unmentioned-plain-command-from-the-owner-is-a-command
  =/  heard  (owner-says ~[[%inline ~['/stop']]])
  ?~  heard  (expect !>(|))
  ;:  weld
      (expect-eq !>('/stop') !>((observed u.heard)))
      (expect !>((stopping:cmd (observed u.heard))))
  ==
++  test-formatted-or-multi-paragraph-commands-are-attributed-text
  =/  examples=(list story:d)
    :~  ~[[%inline ~[[%inline-code '/stop']]]]
        ~[[%inline ~[[%blockquote ~['/stop']]]]]
        ~[[%inline ~['/memory off']] [%inline ~['second paragraph']]]
        ~[[%inline ~['hello']] [%inline ~['/stop']]]
    ==
  %-  expect
  !>  %+  levy  examples
      |=  content=story:d
      =/  heard  (owner-says content)
      ?~  heard  |
      =/  text  (observed u.heard)
      ?&  =(~ (parse:cmd text))
          =(text (attribute:input ~nec to.u.heard (story-to-text:story content)))
          =('~nec: ' (end 3^6 text))
      ==
++  test-attribution-is-never-added-twice
  =/  room=destination:t  [%channel [%chat ~lux %test] ~]
  ;:  weld
      (expect-eq !>('~bus: hello') !>((attribute:input ~bus room '~bus: hello')))
      (expect-eq !>('~bus: ~nec: hello') !>((attribute:input ~bus room '~nec: hello')))
  ==
::  Every channel message names its speaker, even one that starts with a
::  slash: the adapter leaves out text the head parses as a command before
::  attributing, so a path reaches the model attributed.
::
++  test-channel-input-names-its-speaker
  =/  room=destination:t  [%channel [%chat ~lux %test] ~]
  =/  thread=destination:t  [%channel [%chat ~lux %test] `~2026.9.1]
  ;:  weld
      (expect-eq !>('~bus: hello') !>((attribute:input ~bus room 'hello')))
      (expect-eq !>('~bus: hello') !>((attribute:input ~bus thread 'hello')))
      %+  expect-eq
        !>('~bus: /tmp/file is broken')
      !>((attribute:input ~bus room '/tmp/file is broken'))
      (expect-eq !>(~) !>((parse:cmd '/tmp/file is broken')))
  ==
++  test-dm-input-is-not-prefixed
  =/  dm=destination:t  [%dm ~bus ~]
  =/  thread=destination:t  [%dm ~bus `[~bus ~2026.9.1]]
  ;:  weld
      (expect-eq !>('hello') !>((attribute:input ~bus dm 'hello')))
      (expect-eq !>('hello') !>((attribute:input ~bus thread 'hello')))
  ==
::  The hand refuses text over 65,536 bytes. A channel message is admitted
::  only while it still fits with its speaker's prefix; a DM's limit is the
::  hand's.
::
++  test-a-prefixed-channel-message-always-fits-the-hands-limit
  =/  most  (sub 65.536 attribution-limit:input)
  =/  fits  (fil 3 most 'a')
  =/  long  (fil 3 +(most) 'a')
  =/  policy=policy:t  [& `~nec ~ %all ~ ~]
  =/  comet=@p  (dec (bex 128))
  =/  post
    |=  text=@t
    ^-  incoming-event:v8:a
    [%post [[comet ~2026.9.4] ~2026.9.4] [%chat ~lux %test] [~lux %test] ~[[%inline ~[text]]] &]
  =/  admitted  (normalize-owned:p ~lux ~2026.9.4 policy (post fits) |=(@p &))
  =/  dm-long=incoming-event:v8:a
    [%dm-post [[comet ~2026.9.4] ~2026.9.4] [%ship comet] ~[[%inline ~[long]]] |]
  ::  Formatted text is attributed at admission; the limit is the raw text's.
  =/  quoted=incoming-event:v8:a
    :*  %post  [[comet ~2026.9.4] ~2026.9.4]  [%chat ~lux %test]  [~lux %test]
        ~[[%inline ~[[%blockquote ~[fits]]]]]  &
    ==
  =/  formatted  (normalize-owned:p ~lux ~2026.9.4 policy quoted |=(@p &))
  ;:  weld
      (expect !>(?=(^ admitted)))
      (expect !>(?=(~ (normalize-owned:p ~lux ~2026.9.4 policy (post long) |=(@p &)))))
      (expect !>(?=(^ (normalize-owned:p ~lux ~2026.9.4 policy dm-long |=(@p &)))))
      ?~  admitted  ~
      %+  expect-eq  !>(65.536)
      !>((met 3 (attribute:input comet to.u.admitted text.u.admitted)))
      ?~  formatted  (expect !>(|))
      %+  expect-eq  !>(65.536)
      !>((met 3 (attribute:input comet to.u.formatted text.u.formatted)))
  ==
--

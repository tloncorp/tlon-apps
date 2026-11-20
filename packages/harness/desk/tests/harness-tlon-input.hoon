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
  =/  =policy:t  [& `~nec ~ %mentions ~ ~]
  =/  event=$>(%post incoming-event:v8:a)
    :*  %post  [[~nec ~2026.9.6] ~2026.9.6]  [%chat ~nec %test]  [~nec %test]
        ~[[%inline ~[[%ship ~lux] ' /memory']]]  |
    ==
  =/  allowed  (normalize:p ~lux policy event(mention &))
  ?>  ?=(^ allowed)
  %-  expect
  !>  ?&  =('/memory' text.u.allowed)  =(~ (normalize:p ~lux policy event))
          =(~ (normalize:p ~lux policy(enabled |) event(mention &)))
      ==
--

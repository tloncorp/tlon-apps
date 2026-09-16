::  prompts wire codecs: snapshots, edits, terminal and pending responses
::
/-  p=steward-prompts
/+  *test, pj=steward-prompts-json
|%
++  parse
  |=  text=@t
  ^-  json
  (need (de:json:html text))
++  test-project-json
  %+  expect-eq
    !>(`action:v1:p`[%project (my ~[['SOUL.md' 'hello']])])
  !>((action:dejs:pj (parse '{"project":{"SOUL.md":"hello"}}')))
++  test-empty-projection-is-object
  %+  expect-eq
    !>((parse '{"project":{}}'))
  !>((action:enjs:pj [%project *prompts:v1:p]))
++  test-edit-json
  %+  expect-eq
    !>(`action:v1:p`[%edit 0v1 ~bus %set 'SOUL.md' 'hello'])
  !>((action:dejs:pj (parse '{"edit":{"requestId":"0v1","bot":"~bus","action":{"set":{"name":"SOUL.md","text":"hello"}}}}')))
++  test-finalize-json
  %+  expect-eq
    !>(`action:v1:p`[%finalize 0v1 %updated 'SOUL.md'])
  !>((action:dejs:pj (parse '{"finalize":{"requestId":"0v1","body":{"type":"updated","name":"SOUL.md"}}}')))
++  test-pending-is-not-a-finalize
  =/  got
    %-  mule
    |.  (action:dejs:pj (parse '{"finalize":{"requestId":"0v1","body":{"type":"pending","status":"acked"}}}'))
  (expect-eq !>(%|) !>(-.got))
++  test-pending-response-roundtrip
  =/  =response:v1:p  [0v1 %pending %acked]
  (expect-eq !>(response) !>((response:dejs:pj (response:enjs:pj response))))
++  test-error-response-json
  %+  expect-eq
    !>((parse '{"requestId":"0v1","body":{"type":"error","errorType":"harness-offline","message":[]}}'))
  !>((response:enjs:pj [0v1 %error %harness-offline ~]))
++  test-files-roundtrip
  =/  files=(map ship prompts:v1:p)
    (my ~[[~bus (my ~[['SOUL.md' 'hello']])] [~dev *prompts:v1:p]])
  (expect-eq !>(files) !>((ship-files:dejs:pj (ship-files:enjs:pj files))))
++  test-update-roundtrips
  %-  zing
  %+  turn
    ^-  (list update:v1:p)
    :~  [%files (my ~[[~bus (my ~[['SOUL.md' 'hello']])]])]
        [%set ~bus 'SOUL.md' 'new']
        [%del ~bus 'SOUL.md']
        [%gone ~bus]
    ==
  |=  =update:v1:p
  (expect-eq !>(update) !>((update:dejs:pj (update:enjs:pj update))))
++  test-dispatch-json
  %+  expect-eq
    !>((parse '{"requestId":"0v1","action":{"set":{"name":"SOUL.md","text":"hello"}}}'))
  !>((dispatch:enjs:pj [0v1 %set 'SOUL.md' 'hello']))
--

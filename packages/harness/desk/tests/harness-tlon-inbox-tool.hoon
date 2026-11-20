::  Inbox projections preserve native identities and bounded feed continuation.
/-  a=activity-ver
/+  *test, inbox=harness-tlon-inbox-tool, hp=harness-tlon-history-page
|%
++  field
  |=  [value=json key=@t]
  ?>  ?=(%o -.value)
  (~(got by p.value) key)
++  test-inbox-message-identities-distinguish-channel-and-dm-keys
  =/  lib  ~(. inbox *bowl:gall)
  =/  key=message-key:a  [[~bud ~2026.9.6] ~2026.9.7]
  =/  content  ~[[%inline ~['Text']]]
  =/  cases=(list [incoming-event:v8:a @t])
    :~  [[%post key [%chat ~lux %test] [~lux %test] content &] (scot %da ~2026.9.7)]
        [[%reply key key [%chat ~lux %test] [~lux %test] content &] (scot %da ~2026.9.7)]
        [[%dm-post key [%club 0v1] content &] (cat 3 '~bud/' (scot %da ~2026.9.6))]
        [[%dm-reply key key [%club 0v1] content &] (cat 3 '~bud/' (scot %da ~2026.9.6))]
    ==
  %-  zing
  %+  turn  cases
  |=  [incoming=incoming-event:v8:a id=@t]
  =/  actual  (event:lib [~2026.10.1 incoming | |])
  =/  expected
    %-  pairs:enjs:format
    :~  ['type' %s -.incoming]
        ['at' %s (scot %da ~2026.10.1)]
        ['message_id' %s id]
        ['text' %s 'Text']
        ['mention' %b &]
    ==
  (expect-eq !>(expected) !>(actual))
++  read-feed
  |=  count=@ud
  ^-  json
  =/  =bowl:gall  *bowl:gall
  =.  bowl  bowl(our ~lux, src ~lux, now ~2026.10.1)
  =/  bundles=(list activity-bundle:v8:a)
    ?:  =(0 count)  ~
    %+  turn  (gulf 1 count)
    |=  n=@ud
    =/  latest  (sub now.bowl n)
    =/  event=time-event:v8:a  [latest [%dm-invite %club 0v1] | |]
    [[%dm %club 0v1] latest ~[event event event event]]
  =/  attempt
    |.
    (read:~(. inbox bowl) (pairs:enjs:format ~[['filter' %s 'mentions']]))
  =/  checked
    %+  mink  [attempt %9 2 %0 1]
    |=  [ref=* raw=*]
    ^-  (unit (unit noun))
    =/  path  ;;(path raw)
    ?:  =(%$ (rear path))  ``&
    ?:  (lien path |=(part=@ta =(%feed part)))
      ``[bundles *activity:v8:a]
    ~
  ?>  ?=(%0 -.checked)
  ;;(json product.checked)
++  test-inbox-feed-uses-lookahead-and-bounds-events
  =/  first  (read-feed 11)
  =/  items  (field first 'items')
  ?>  ?=([%a [* *]] items)
  =/  events  (field i.p.items 'events')
  ?>  ?=(%a -.events)
  =/  scope  (sham [%tlon-inbox ~lux 'mentions'])
  =/  next  (cursor:hp scope (sub ~2026.10.1 10))
  ;:  weld
      (expect-eq !>(10) !>((lent p.items)))
      (expect-eq !>(3) !>((lent p.events)))
      (expect-eq !>([%b &]) !>((field i.p.items 'events_truncated')))
      (expect-eq !>([%s next]) !>((field first 'next_cursor')))
      (expect-eq !>([%b &]) !>((field first 'has_more')))
      (expect-eq !>(~) !>((field (read-feed 10) 'next_cursor')))
      (expect-eq !>([%a ~]) !>((field (read-feed 0) 'items')))
  ==
--

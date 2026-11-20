::  Synthetic visual fixtures from the shipping projection; no ship effects.
/-  wc=harness-work-control
/+  card=harness-tlon-work-card, control=harness-work-control, view=harness-work-view
:-  %say
|=  [[now=@da eny=@uvJ bec=beak] ~ ~]
:-  %tang
=/  r=request:wc
  :*  'fixture'  0v1  [%hand 'fixture' 'tlon' 'dm/~zod' 'e' '~zod']  ~  'project-create'
      (pairs:enjs:format ~[['project' %s 'meeting'] ['title' %s 'Draft the agenda']])  0v2
      ~2026.9.13..18.30.00  %pending  ~
  ==
=/  row
  |=  [request=request:wc inspected=? current=?]
  ^-  json
  =/  value  (encode:control 0v3 request)
  ?>  ?=(%o -.value)
  =?  value  =('review' action.request)
    :*  %o
        %+  ~(put by p.value)
          'proposal'
        %-  need
        %-  de:json:html
        '{"content":{"title":"Meeting checklist","body":"Before the meeting: confirm attendees and share the agenda.\\nDuring the meeting: record decisions and owners.\\nAfter the meeting: send action items.","sources":[]}}'
    ==
  =?  value  =('task-reply' action.request)
    =/  reply
      %-  need
      %-  de:json:html
      '{"address":"dm/~zod","actor":"~zod","text":"Before the meeting: confirm attendees and share the agenda.\\nDuring the meeting: record decisions and owners.\\nAfter the meeting: send action items."}'
    =/  fields  (~(put by p.value) 'reply' reply)
    :*  %o
        %+  ~(put by fields)
          'delivery'
        ?~(result.request [%o ~] ?:(?=(%& -.u.result.request) p.u.result.request [%o ~]))
    ==
  %-  pairs:enjs:format
  :~  ['blob' %s (render:card 0v3 request inspected current value)]
      :*  'text'  %s
          ?:(inspected (receipt:view value) 'I prepared the change. Review it before continuing.')
      ==
  ==
=/  added
  %-  need
  %-  de:json:html
  '{"id":"w-192795150078560683588837229400002435572","project":"meeting","title":"Draft the agenda","description":"","status":"open","version":1,"claimant":null,"outcome":"","artifact":null,"updated":1789393586796}'
=/  fixtures
  %-  pairs:enjs:format
  :~  ['Ready' (row r & &)]  ['Inspect' (row r | &)]
      ['Settled' (row r(status %done, result `[%& added]) & &)]  ['Expired' (row r & |)]
      :*  'ReviewReady'
          (row r(action 'review', args (need (de:json:html '{"id":"draft","accept":true}'))) & &)
      ==
      ['SendReady' (row r(action 'task-reply') & &)]
      :*  'Delivered'
          %^  row
            %=  r  action  'task-reply'  status  %done  result
                `[%& (need (de:json:html '{"status":"delivered","address":"dm/~zod"}'))]
            ==
            &
          &
      ==
      :*  'Uncertain'
          %^  row
            %=  r  action  'task-reply'  status  %done  result
                `[%& (need (de:json:html '{"status":"uncertain","address":"dm/~zod"}'))]
            ==
            &
          &
      ==
  ==
~[[%leaf (trip (cat 3 'HARNESS_WORK_CARD_FIXTURE ' (en:json:html fixtures)))]]

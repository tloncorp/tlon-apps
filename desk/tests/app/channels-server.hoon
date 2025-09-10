/-  c=channels, h=hooks
/+  *test-agent, imp=import-aid
/=  agent  /app/channels-server
::
|%
++  dap  %channels-server
::
+$  current-state
  [%11 =v-channels:v9:c =hooks:h =pimp:imp]
  :: [%10 =v-channels:c =hooks:h =pimp:imp]
+$  state-8
  [%8 =v-channels:v8:c =hooks:h =pimp:imp]
::
++  skip-poke-wire
  |=  wire=path
  |=  =card
  ?.  ?=([%pass * %agent * %poke *] card)  |
  =(wire p.card)
::
++  ex-cards
  |=  [caz=(list card) exes=(list $-(card tang))]
  (ex-filter-cards caz (skip-poke-wire /logs) exes)
--
::
|%
::  channels agent will send pokes requesting sequence nrs, we must respond
::
++  test-send-sequence-nrs
  %-  eval-mare
  =/  m  (mare ,~)
  ;<  *  bind:m  (do-init dap agent)
  ::  channel doesn't exist, should no-op
  ::
  ;<  caz=(list card)  bind:m
    ((do-as ~fun) (do-poke %noun !>([%send-sequence-numbers *nest:c])))
  ;<  ~  bind:m  (ex-cards caz ~)
  ::  channel exists, should send list of seqs nrs
  ::
  =/  state=state-8
    =+  c=v8:c
    =;  chan=v-channel:c
      [%8 (~(put by *v-channels:c) *nest:c chan) *hooks:h *pimp:imp]
    =;  posts
      :_  *local:v-channel:c
      ^-  global:v-channel:c
      [posts count=333 *(rev:c arranged-posts:c) *(rev:c view:c) *(rev:c sort:c) *(rev:c perm:c) *(rev:c (unit @t))]
    %+  gas:on-v-posts:c  ~
    =*  k  ~2025.8.4
    =;  p=v-post:c
      [k `p]~
    :*  [id=k seq=777 mod-at=k replies=~ reacts=~]
        rev=0
        [content=[[%inline 'a' ~] ~] author=~zod sent=k]
        [kind=/chat meta=~ blob=~]
    ==
  ::  edit carefully to work around lib negotiate state.
  ::  yes, the inner state is double-vased!
  ::
  ;<  save=vase  bind:m  get-save
  =.  save
    ;:  slop
      (slot 2 save)  ::  lib discipline
      (slot 6 save)  ::  lib negotiate
      !>(!>(state))  ::  negotiate's double-vasing
    ==
  ;<  *  bind:m  (do-load agent `save)
  ;<  caz=(list card)  bind:m
    ((do-as ~fun) (do-poke %noun -:!>(**) [%send-sequence-numbers *nest:c]))
  %+  ex-cards  caz
  =/  =vase
    !>  :^  %sequence-numbers  *nest:c
      1
    ^-  (list [id-post:c (unit @ud)])
    :~  [~2025.8.4 `1]
    ==
  :~  (ex-poke /numbers [~fun %channels] %noun vase)
  ==
::  migration 7->8 used to drop message tombstones.
::  if we're in that state, we must recover them from the log.
::
++  test-tombstone-rescue
  |^  test
  ++  tombstone-rescue-key
    ~2025.6.25..14.41.13..585b
  ++  tombstone-rescue-test-channel-old
    =+  c=v8:c
    ^-  v-channel:c
    :-  ^-  global:v-channel:c
        :*  ^=  posts
            %+  gas:on-v-posts:c  ~
            :~  :*  key=~2025.6.25..14.41.11..9300
                    ~
                    [id=~2025.6.25..14.41.11..9300 seq=1 mod-at=~2025.6.25..14.41.11..9300 replies=~ reacts=~]
                    rev=0
                    :*  content=[[%inline 'one' [%break ~] ~] ~]
                          author=~zod
                          sent=~2025.6.25..14.41.11..9062.4dd2.f1a9.fbe7
                    ==
                    [kind=/chat meta=~ blob=~]
                ==
                :*  key=tombstone-rescue-key
                    ~
                ==
                :*  key=~2025.6.25..14.41.14..84fa
                    ~
                    [id=~2025.6.25..14.41.14..84fa seq=3 mod-at=~2025.6.25..14.41.14..84fa replies=~ reacts=~]
                    rev=0
                    :*  content=[[%inline 'three' [%break ~] ~] ~]
                          author=~zod
                          sent=~2025.6.25..14.41.14..6ccc.cccc.cccc.cccc
                    ==
                    [kind=/chat meta=~ blob=~]
                ==
            ==
          ::
            count=3
            *(rev:c arranged-posts:c)
            *(rev:c view:c)
            *(rev:c sort:c)
            *(rev:c perm:c)
            *(rev:c (unit @t))
        ==
    ^-  local:v-channel:c
    :*  *net:c
      ::
        ^=  log
        %+  gas:log-on:c  ~
        :~  :*  key=~2025.6.25..14.41.11..9300
                %post
                id=~2025.6.25..14.41.11..9300
                %set
                ~
                [id=~2025.6.25..14.41.11..9300 seq=1 mod-at=~2025.6.25..14.41.11..9300 replies=~ reacts=~]
                rev=0
                :*  content=[[%inline 'one' [%break ~] ~] ~]
                    author=~zod
                    sent=~2025.6.25..14.41.11..9062.4dd2.f1a9.fbe7
                ==
                [kind=/chat meta=~ blob=~]
            ==
            :*  key=tombstone-rescue-key
                %post
                id=tombstone-rescue-key
                %set
                ~
                [id=tombstone-rescue-key seq=2 mod-at=~2025.6.25..14.41.13..585b replies=~ reacts=~]
                rev=0
                :*  content=[[%inline 'two' [%break ~] ~] ~]
                    author=~zod
                    sent=~2025.6.25..14.41.13..54bc.6a7e.f9db.22d0
                ==
                [kind=/chat meta=~ blob=~]
            ==
            :*  key=~2025.6.25..14.41.14..84fa
                %post
                id=~2025.6.25..14.41.14..84fa
                %set
                ~
                [id=~2025.6.25..14.41.14..84fa seq=3 mod-at=~2025.6.25..14.41.14..84fa replies=~ reacts=~]
                rev=0
                :*  content=[[%inline 'three' [%break ~] ~] ~]
                    author=~zod
                    sent=~2025.6.25..14.41.14..6ccc.cccc.cccc.cccc
                ==
                [kind=/chat meta=~ blob=~]
            ==
            :*  key=~2025.6.25..14.41.25..8ccf
                [%post id=tombstone-rescue-key u-post=[%set post=~]]
            ==
        ==
      ::
        *remark:c
        *window:v-channel:c
        *future:v-channel:c
        *pending-messages:c
        *last-updated:c
    ==
  ++  tombstone-rescue-test-channel-new
    ^-  v-channel:c
    :-  ^-  global:v-channel:c
        :*  ^=  posts
            %+  gas:on-v-posts:c  ~
            :~  :*  key=~2025.6.25..14.41.11..9300
                    %&
                    [id=~2025.6.25..14.41.11..9300 seq=1 mod-at=~2025.6.25..14.41.11..9300 replies=~ reacts=~]
                    rev=0
                    :*  content=[[%inline 'one' [%break ~] ~] ~]
                          author=~zod
                          sent=~2025.6.25..14.41.11..9062.4dd2.f1a9.fbe7
                    ==
                    [kind=/chat meta=~ blob=~]
                ==
                :*  key=tombstone-rescue-key
                    [%| id=tombstone-rescue-key author=~zod seq=2 del-at=~2025.6.25..14.41.25..8ccf]
                ==
                :*  key=~2025.6.25..14.41.14..84fa
                    %&
                    [id=~2025.6.25..14.41.14..84fa seq=3 mod-at=~2025.6.25..14.41.14..84fa replies=~ reacts=~]
                    rev=0
                    :*  content=[[%inline 'three' [%break ~] ~] ~]
                          author=~zod
                          sent=~2025.6.25..14.41.14..6ccc.cccc.cccc.cccc
                    ==
                    [kind=/chat meta=~ blob=~]
                ==
            ==
          ::
            count=3
            *(rev:c arranged-posts:c)
            *(rev:c view:c)
            *(rev:c sort:c)
            *(rev:c perm:c)
            *(rev:c (unit @t))
        ==
    ^-  local:v-channel:c
    :*  *net:c
      ::
        ^=  log
        %+  gas:log-on:c  ~
        :~  :*  key=~2025.6.25..14.41.11..9300
                %post
                id=~2025.6.25..14.41.11..9300
                %set
                %&
                [id=~2025.6.25..14.41.11..9300 seq=1 mod-at=~2025.6.25..14.41.11..9300 replies=~ reacts=~]
                rev=0
                :*  content=[[%inline 'one' [%break ~] ~] ~]
                    author=~zod
                    sent=~2025.6.25..14.41.11..9062.4dd2.f1a9.fbe7
                ==
                [kind=/chat meta=~ blob=~]
            ==
            :*  key=tombstone-rescue-key
                %post
                id=tombstone-rescue-key
                %set
                %&
                [id=tombstone-rescue-key seq=2 mod-at=~2025.6.25..14.41.13..585b replies=~ reacts=~]
                rev=0
                :*  content=[[%inline 'two' [%break ~] ~] ~]
                    author=~zod
                    sent=~2025.6.25..14.41.13..54bc.6a7e.f9db.22d0
                ==
                [kind=/chat meta=~ blob=~]
            ==
            :*  key=~2025.6.25..14.41.14..84fa
                %post
                id=~2025.6.25..14.41.14..84fa
                %set
                %&
                [id=~2025.6.25..14.41.14..84fa seq=3 mod-at=~2025.6.25..14.41.14..84fa replies=~ reacts=~]
                rev=0
                :*  content=[[%inline 'three' [%break ~] ~] ~]
                    author=~zod
                    sent=~2025.6.25..14.41.14..6ccc.cccc.cccc.cccc
                ==
                [kind=/chat meta=~ blob=~]
            ==
            :*  key=~2025.6.25..14.41.25..8ccf
                [%post id=tombstone-rescue-key u-post=[%set post=[%| id=tombstone-rescue-key author=~zod seq=2 del-at=~2025.6.25..14.41.25..8ccf]]]
            ==
        ==
      ::
        *remark:c
        *window:v-channel:c
        *future:v-channel:c
        *pending-messages:c
        *last-updated:c
    ==
  ++  test
    %-  eval-mare
    =/  m  (mare ,~)
    =/  bad-state=state-8
      =+  c=v8:c
      =;  chans=v-channels:c
        [%8 chans *hooks:h *pimp:imp]
      =/  chan=v-channel:c
        tombstone-rescue-test-channel-old
      ::  state has post deletion in the log but no matching tombstone
      ::  due to bad 7->8 migration in old code
      ::
      =.  posts.chan
        +:(del:on-v-posts:c posts.chan tombstone-rescue-key)
      (~(put by *v-channels:c) *nest:c chan)
    ;<  *  bind:m  (do-init dap agent)
    ::  edit carefully to work around lib negotiate state.
    ::  yes, the inner state is double-vased!
    ::
    ;<  save=vase  bind:m  get-save
    =.  save
      ;:  slop
        (slot 2 save)      ::  lib discipline
        (slot 6 save)      ::  lib negotiate
        !>(!>(bad-state))  :: negotiate's double-vasing
      ==
    ;<  caz=(list card:agent:gall)  bind:m  (do-load agent `save)
    ::
    ;<  ~  bind:m  (ex-cards caz ~)
    ;<  save=vase  bind:m  get-save
    =/  fixed-state=current-state
      =;  chans=v-channels:c
        [%11 chans *hooks:h *pimp:imp]
      =/  chan=v-channel:c
        tombstone-rescue-test-channel-new
      (~(put by *v-channels:c) *nest:c chan)
    ::  again, carefully work around lib negotiate state.
    ::
    =.  save  (slot 3 save)           ::  lib discipline
    =.  save  !<(vase (slot 3 save))  ::  lib negotiate
    (ex-equal save !>(fixed-state))
  --
--

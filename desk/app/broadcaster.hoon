::  broadcaster: multi-target dms
::
/-  c=chat, c3=chat-3
/+  cu=channel-utils, cj=channel-json,
    dbug, verb
::
|%
+$  state-1
  $:  %1
      cohorts=(map @t cohort)
  ==
::
+$  cohort
  $:  targets=(set ship)
      logging=(list relive)
      outward=(list writ:c)  ::NOTE  invented-here fake seal?
  ==
::
+$  relive
  $:  wen=@da
  $%  [%add targets=(set ship)]
      [%del targets=(set ship)]
      [%msg =story:d:c]
      [%err err=@t]
  ==  ==
::
+$  action
  $%  [%add-cohort cohort=@t targets=(set ship)]
      [%del-cohort cohort=@t targets=(set ship)]  ::  ~ for full deletion
      [%broadcast cohort=@t =story:d:c]
      [%delete cohort=@t time-id=@da]
  ==
::
++  update
  $%  action
  ==
::
+$  card  card:agent:gall
--
::
%+  verb  |
%-  agent:dbug
^-  agent:gall
::
=|  state-1
=*  state  -
::
|_  =bowl:gall
+*  this  .
::
++  on-init
  ^-  (quip card _this)
  [~ this]
::
++  on-save  !>(state)
++  on-load
  |=  ole=vase
  |^  ^-  (quip card _this)
      =+  !<(old=state-any ole)
      =?  old  ?=(%0 -.old)  (state-0-to-1 old)
      ?>  ?=(%1 -.old)
      [~ this(state old)]
  ::
  +$  state-any  $%(state-0 state-1)
  ::
  +$  state-0  [%0 cohorts=(map @t cohort-0)]
  +$  cohort-0
    $:  targets=(set ship)
        logging=(list relive)
        outward=(list writ:c3)  ::NOTE  invented-here fake seal?
    ==
  +$  relive
    $:  wen=@da
    $%  [%add targets=(set ship)]
        [%del targets=(set ship)]
        [%msg =story:v7:old:d:c3]  ::NOTE  this nests in newer type
        [%err err=@t]
    ==  ==
  ::
  ++  state-0-to-1
    |=  s=state-0
    ^-  state-1
    %=  s  -  %1
        cohorts
      %-  ~(run by cohorts.s)
      |=  c=cohort-0
      c(outward (turn outward.c writ-c3-to-c))
    ==
  ::NOTE  the below copied from /app/chat.hoon
  ++  writ-c3-to-c
    |=  =writ:c3
    ^-  writ:c
    %=  writ
      reacts  (~(run by reacts.writ) react-7-to-8:cu)
      replies  (run:on:replies:c3 replies.writ reply-c3-to-c)
      :: essay
      +  =-  ?>(?=([%chat *] kind.-) -)
         (essay-7-to-8:cu +.writ)
    ==
  ++  reply-c3-to-c
    |=  =reply:c3
    ^-  reply:c
    %=  reply
      reacts  (~(run by reacts.reply) react-7-to-8:cu)
      ::  memo
      +  (memo-7-to-8:cu +.reply)
    ==
  --
::
++  on-poke
  |=  [=mark =vase]
  ^-  (quip card _this)
  ?:  &(?=(%noun mark) ?=([@ *] q.vase))
    $(mark -.q.vase, vase (slot 3 vase))
  ?>  ?=(%broadcaster-action mark)
  =+  !<(=action vase)
  ?-  -.action
      %add-cohort
    =/  =cohort
      (~(gut by cohorts) cohort.action *cohort)
    =/  dif=(set ship)
      (~(dif in targets.action) targets.cohort)
    ?:  =(~ dif)  [~ this]
    =.  targets.action  dif
    =.  targets.cohort  (~(uni in targets.cohort) dif)
    =.  logging.cohort
      ::  unify actions in logging when possible
      ::
      ?:  ?=([[@ %add *] *] logging.cohort)
        =-  logging.cohort(targets.i -, wen.i now.bowl)
        (~(uni in targets.i.logging.cohort) targets.action)
      [[now.bowl %add targets.action] logging.cohort]
    :_  this(cohorts (~(put by cohorts) cohort.action cohort))
    [%give %fact [/updates]~ %cohort-update !>(`update`action)]~
  ::
      %del-cohort
    =/  =cohort
      (~(got by cohorts) cohort.action)
    ?:  =(~ targets.action)
      :_  this(cohorts (~(del by cohorts) cohort.action))
      [%give %fact [/updates]~ %cohort-update !>(`update`action)]~
    =/  int=(set ship)
      (~(int in targets.cohort) targets.action)
    ?:  =(~ int)  [~ this]
    =.  targets.action  int
    =.  targets.cohort  (~(dif in targets.cohort) targets.action)
    =.  logging.cohort
      ::  unify actions in logging when possible
      ::
      ?:  ?=([[@ %del *] *] logging.cohort)
        =-  logging.cohort(targets.i -, wen.i now.bowl)
        (~(uni in targets.i.logging.cohort) targets.action)
      [[now.bowl %del targets.action] logging.cohort]
    :_  this(cohorts (~(put by cohorts) cohort.action cohort))
    [%give %fact [/updates]~ %cohort-update !>(`update`action)]~
  ::
      %broadcast
    =/  =cohort
      (~(got by cohorts) cohort.action)
    =.  logging.cohort
      [[now.bowl %msg story.action] logging.cohort]
    :_  this(cohorts (~(put by cohorts) cohort.action cohort))
    %+  turn
      ~(tap in targets.cohort)
    |=  who=ship
    ^-  card
    =/  =wire
      /broadcast/(scot %t cohort.action)/(scot %da now.bowl)/(scot %p who)
    =;  =action:dm:c
      [%pass wire %agent [our.bowl %chat] %poke %chat-dm-action !>(action)]
    =;  =essay:c
      [who [our now]:bowl %add essay ~]
    :*  `memo:d:c`[story.action our.bowl now.bowl]
        kind=[%chat /]
        meta=~
        blob=~
    ==
  ::
      %delete
    =/  =cohort
      (~(got by cohorts) cohort.action)
    =^  log  logging.cohort
      %+  skid  logging.cohort
      |=(relive =(time-id.action wen))
    ?>  ?=([* ~] log)
    :_  this(cohorts (~(put by cohorts) cohort.action cohort))
    %+  turn
      ~(tap in targets.cohort)
    |=  who=ship
    ^-  card
    =/  =wire
      /delete/(scot %t cohort.action)/(scot %da time-id.action)/(scot %p who)
    =/  =id:c         [our.bowl time-id.action]
    =/  =action:dm:c  [who id %del ~]
    [%pass wire %agent [our.bowl %chat] %poke %chat-dm-action !>(action)]
  ==
::
++  on-agent
  |=  [=wire sign=sign:agent:gall]
  ^-  (quip card _this)
  ?>  ?=([?(%broadcast %delete) cohort=@ msg=@ ship=@ ~] wire)
  ::TODO  handle nacks
  [~ this]
::
++  on-peek
  |=  =path
  ^-  (unit (unit cage))
  =/  cohort-to-json
    |=  [t=@t cohort]
    ^-  json
    =,  enjs:format
    %-  pairs
    :_  :~  'title'^s+t
            'targets'^a+(turn ~(tap in targets) |=(=@p s+(scot %p p)))
        ==
    :-  'logging'
    :-  %a
    %+  turn  logging
    |=  r=relive
    %-  pairs
    :_  ['wen'^s+(scot %da wen.r)]~
    =;  j=json  ['log' o+[+<.r^j ~ ~]]
    ?-  +<.r
      %add  a+(turn ~(tap in targets.r) |=(=@p s+(scot %p p)))
      %del  a+(turn ~(tap in targets.r) |=(=@p s+(scot %p p)))
      %msg  (story:enjs:cj story.r)
      %err  s+err.r
    ==
  ?+  path  [~ ~]
      [%x %cohorts ~]
    ``noun+!>(cohorts)
  ::
      [%x %cohorts %json ~]
    :^  ~  ~  %json
    !>  ^-  json
    %-  pairs:enjs:format
    %+  turn  ~(tap by cohorts)
    |=  [t=@t c=cohort]
    [(scot %t t) (cohort-to-json t c)]
  ::
      [%x %cohorts @ ~]
    ``noun+!>((~(got by cohorts) (slav %t i.t.t.path)))
  ::
      [%x %cohorts @ %json ~]
    :^  ~  ~  %json
    !>  ^-  json
    =/  t=@t  (slav %t i.t.t.path)
    (cohort-to-json t (~(got by cohorts) t))
  ==
::
++  on-watch  |=(* `this)
++  on-leave  |=(* `this)
++  on-arvo   |=(* `this)
::
++  on-fail
  |=  [=term =tang]
  ^-  (quip card _this)
  %-  (slog (rap 3 dap.bowl ': on-fail: ' term ~) tang)
  [~ this]
--

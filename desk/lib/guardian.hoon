::  guardian: custom card types for compile-time marked-data guard rails
::
::    xx
::
/%  noun  %noun
/%  loob  %loob
/%  json  %json
/%  chat-blocked-by  %chat-blocked-by
/%  chat-changed-writs  %chat-changed-writs
/%  chat-changed-writs-1  %chat-changed-writs-1
/%  chat-club-action  %chat-club-action
/%  chat-club-action-0  %chat-club-action-0
/%  chat-club-action-1  %chat-club-action-1
/%  chat-club-action-2  %chat-club-action-2
/%  chat-dm-action  %chat-dm-action
/%  chat-dm-action-1  %chat-dm-action-1
/%  chat-dm-diff  %chat-dm-diff
/%  chat-dm-diff-1  %chat-dm-diff-1
/%  chat-dm-diff-2  %chat-dm-diff-2
/%  chat-heads  %chat-heads
/%  chat-heads-1  %chat-heads-1
/%  chat-heads-2  %chat-heads-2
/%  chat-heads-3  %chat-heads-3
/%  chat-heads-4  %chat-heads-4
/%  chat-paged-writs  %chat-paged-writs
/%  chat-paged-writs-1  %chat-paged-writs-1
/%  chat-paged-writs-2  %chat-paged-writs-2
/%  chat-paged-writs-3  %chat-paged-writs-3
/%  chat-scam  %chat-scam
/%  chat-scam-1  %chat-scam-1
/%  chat-scam-2  %chat-scam-2
/%  chat-scam-3  %chat-scam-3
/%  chat-scan  %chat-scan
/%  chat-scan-1  %chat-scan-1
/%  chat-scan-2  %chat-scan-2
/%  chat-scan-3  %chat-scan-3
/%  chat-toggle-message  %chat-toggle-message
/%  chat-unblocked-by  %chat-unblocked-by
/%  chat-unread-update  %chat-unread-update
/%  chat-unreads  %chat-unreads
/%  chat-writ-1  %chat-writ-1
/%  chat-writ-2  %chat-writ-2
/%  chat-writ-3  %chat-writ-3
/%  clubs  %clubs
/%  epic  %epic
/%  hidden-messages  %hidden-messages
/%  ships  %ships
/%  writ  %writ
/%  writ-response  %writ-response
/%  writ-response-1  %writ-response-1
/%  writ-response-2  %writ-response-2
/%  writ-response-3  %writ-response-3
/%  writ-response-4  %writ-response-4
:: /%  ui-action  %ui-action
/%  channel-action-1  %channel-action-1
/%  chat-blocked  %chat-blocked
/%  chat-unblocked  %chat-unblocked
/%  activity-action  %activity-action
/%  chat-dm-rsvp  %chat-dm-rsvp
/%  contact-action-1  %contact-action-1
/%  dm-rsvp  %dm-rsvp
/%  dm-diff  %dm-diff
/%  club-action  %club-action
::
/%  flag  %flag
|%
+$  rail  $+  rail
  $%  [%unsafe =cage]
    ::
      [%flag _*vale:flag]
      [%noun _*vale:noun]
      [%loob _*vale:loob]
      [%json _*vale:json]
      [%chat-blocked-by $+(chat-blocked-by _*vale:chat-blocked-by)]
      [%chat-changed-writs $+(chat-changed-writs _*vale:chat-changed-writs)]
      [%chat-changed-writs-1 $+(chat-changed-writs-1 _*vale:chat-changed-writs-1)]
      [%chat-club-action $+(chat-club-action _*vale:chat-club-action)]
      [%chat-club-action-0 $+(chat-club-action-0 _*vale:chat-club-action-0)]
      [%chat-club-action-1 $+(chat-club-action-1 _*vale:chat-club-action-1)]
      [%chat-club-action-2 $+(chat-club-action-2 _*vale:chat-club-action-2)]
      [%chat-dm-action $+(chat-dm-action _*vale:chat-dm-action)]
      [%chat-dm-action-1 $+(chat-dm-action-1 _*vale:chat-dm-action-1)]
      [%chat-dm-diff $+(chat-dm-diff _*vale:chat-dm-diff)]
      [%chat-dm-diff-1 $+(chat-dm-diff-1 _*vale:chat-dm-diff-1)]
      [%chat-dm-diff-2 $+(chat-dm-diff-2 _*vale:chat-dm-diff-2)]
      [%chat-heads $+(chat-heads _*vale:chat-heads)]
      [%chat-heads-1 $+(chat-heads-1 _*vale:chat-heads-1)]
      [%chat-heads-2 $+(chat-heads-2 _*vale:chat-heads-2)]
      [%chat-heads-3 $+(chat-heads-3 _*vale:chat-heads-3)]
      [%chat-heads-4 $+(chat-heads-4 _*vale:chat-heads-4)]
      [%chat-paged-writs $+(chat-paged-writs _*vale:chat-paged-writs)]
      [%chat-paged-writs-1 $+(chat-paged-writs-1 _*vale:chat-paged-writs-1)]
      [%chat-paged-writs-2 $+(chat-paged-writs-2 _*vale:chat-paged-writs-2)]
      [%chat-paged-writs-3 $+(chat-paged-writs-3 _*vale:chat-paged-writs-3)]
      [%chat-scam $+(chat-scam _*vale:chat-scam)]
      [%chat-scam-1 $+(chat-scam-1 _*vale:chat-scam-1)]
      [%chat-scam-2 $+(chat-scam-2 _*vale:chat-scam-2)]
      [%chat-scam-3 $+(chat-scam-3 _*vale:chat-scam-3)]
      [%chat-scan $+(chat-scan _*vale:chat-scan)]
      [%chat-scan-1 $+(chat-scan-1 _*vale:chat-scan-1)]
      [%chat-scan-2 $+(chat-scan-2 _*vale:chat-scan-2)]
      [%chat-scan-3 $+(chat-scan-3 _*vale:chat-scan-3)]
      [%chat-toggle-message $+(chat-toggle-message _*vale:chat-toggle-message)]
      [%chat-unblocked-by $+(chat-unblocked-by _*vale:chat-unblocked-by)]
      [%chat-unread-update $+(chat-unread-update _*vale:chat-unread-update)]
      [%chat-unreads $+(chat-unreads _*vale:chat-unreads)]
      [%chat-writ-1 $+(chat-writ-1 _*vale:chat-writ-1)]
      [%chat-writ-2 $+(chat-writ-2 _*vale:chat-writ-2)]
      [%chat-writ-3 $+(chat-writ-3 _*vale:chat-writ-3)]
      [%clubs $+(clubs _*vale:clubs)]
      [%epic $+(epic _*vale:epic)]
      [%hidden-messages $+(hidden-messages _*vale:hidden-messages)]
      [%ships $+(ships _*vale:ships)]
      [%writ $+(writ _*vale:writ)]
      [%writ-response $+(writ-response _*vale:writ-response)]
      [%writ-response-1 $+(writ-response-1 _*vale:writ-response-1)]
      [%writ-response-2 $+(writ-response-2 _*vale:writ-response-2)]
      [%writ-response-3 $+(writ-response-3 _*vale:writ-response-3)]
      [%writ-response-4 $+(writ-response-4 _*vale:writ-response-4)]
      :: [%ui-action $+(ui-action _*vale:ui-action)]
      [%channel-action-1 $+(channel-action-1 _*vale:channel-action-1)]
      [%chat-blocked $+(chat-blocked _*vale:chat-blocked)]
      [%chat-unblocked $+(chat-unblocked _*vale:chat-unblocked)]
      [%activity-action $+(activity-action _*vale:activity-action)]
      [%chat-dm-rsvp $+(chat-dm-rsvp _*vale:chat-dm-rsvp)]
      [%contact-action-1 $+(contact-action-1 _*vale:contact-action-1)]
      [%dm-rsvp $+(dm-rsvp _*vale:dm-rsvp)]
      [%dm-diff $+(dm-diff _*vale:dm-diff)]
      [%club-action $+(club-action _*vale:club-action)]
  ==
++  de-rail
  |=  =rail
  ^-  cage
  ?-  -.rail
    %unsafe  cage.rail
    %noun  [-.rail !>(+.rail)]
    %loob  [-.rail !>(+.rail)]
    %flag  [-.rail !>(+.rail)]
    %json  [-.rail !>(+.rail)]
    %chat-blocked-by  [-.rail !>(+.rail)]
    %chat-changed-writs  [-.rail !>(+.rail)]
    %chat-changed-writs-1  [-.rail !>(+.rail)]
    %chat-club-action  [-.rail !>(+.rail)]
    %chat-club-action-0  [-.rail !>(+.rail)]
    %chat-club-action-1  [-.rail !>(+.rail)]
    %chat-club-action-2  [-.rail !>(+.rail)]
    %chat-dm-action  [-.rail !>(+.rail)]
    %chat-dm-action-1  [-.rail !>(+.rail)]
    %chat-dm-diff  [-.rail !>(+.rail)]
    %chat-dm-diff-1  [-.rail !>(+.rail)]
    %chat-dm-diff-2  [-.rail !>(+.rail)]
    %chat-heads  [-.rail !>(+.rail)]
    %chat-heads-1  [-.rail !>(+.rail)]
    %chat-heads-2  [-.rail !>(+.rail)]
    %chat-heads-3  [-.rail !>(+.rail)]
    %chat-heads-4  [-.rail !>(+.rail)]
    %chat-paged-writs  [-.rail !>(+.rail)]
    %chat-paged-writs-1  [-.rail !>(+.rail)]
    %chat-paged-writs-2  [-.rail !>(+.rail)]
    %chat-paged-writs-3  [-.rail !>(+.rail)]
    %chat-scam  [-.rail !>(+.rail)]
    %chat-scam-1  [-.rail !>(+.rail)]
    %chat-scam-2  [-.rail !>(+.rail)]
    %chat-scam-3  [-.rail !>(+.rail)]
    %chat-scan  [-.rail !>(+.rail)]
    %chat-scan-1  [-.rail !>(+.rail)]
    %chat-scan-2  [-.rail !>(+.rail)]
    %chat-scan-3  [-.rail !>(+.rail)]
    %chat-toggle-message  [-.rail !>(+.rail)]
    %chat-unblocked-by  [-.rail !>(+.rail)]
    %chat-unread-update  [-.rail !>(+.rail)]
    %chat-unreads  [-.rail !>(+.rail)]
    %chat-writ-1  [-.rail !>(+.rail)]
    %chat-writ-2  [-.rail !>(+.rail)]
    %chat-writ-3  [-.rail !>(+.rail)]
    %clubs  [-.rail !>(+.rail)]
    %epic  [-.rail !>(+.rail)]
    %hidden-messages  [-.rail !>(+.rail)]
    %ships  [-.rail !>(+.rail)]
    %writ  [-.rail !>(+.rail)]
    %writ-response  [-.rail !>(+.rail)]
    %writ-response-1  [-.rail !>(+.rail)]
    %writ-response-2  [-.rail !>(+.rail)]
    %writ-response-3  [-.rail !>(+.rail)]
    %writ-response-4  [-.rail !>(+.rail)]
    :: %ui-action  [-.rail !>(+.rail)]
    %channel-action-1  [-.rail !>(+.rail)]
    %chat-blocked  [-.rail !>(+.rail)]
    %chat-unblocked  [-.rail !>(+.rail)]
    %activity-action  [-.rail !>(+.rail)]
    %chat-dm-rsvp  [-.rail !>(+.rail)]
    %contact-action-1  [-.rail !>(+.rail)]
    %dm-rsvp  [-.rail !>(+.rail)]
    %dm-diff  [-.rail !>(+.rail)]
    %club-action  [-.rail !>(+.rail)]
  ==
::
::
+$  card  (wind note gift)
+$  note
  $%  $<(%agent note:agent:gall)
      [%agent [=ship name=term] =task]
  ==
+$  task
  $%  $<(?(%poke %poke-as) task:agent:gall)
      [%poke =rail]
      [%poke-as =mark =rail]
  ==
+$  gift
  $%  $<(%fact gift:agent:gall)
      [%fact paths=(list path) =rail]
  ==
::
++  exit
  |=  cad=card:agent:gall
  ^-  card
  ?<  ?=(%slip -.cad)
  ?+  cad  cad
    [%pass * %agent * %poke *]     cad(cage.task.q [%unsafe cage.task.q.cad])
    [%pass * %agent * %poke-as *]  cad(cage.task.q [%unsafe cage.task.q.cad])
    [%give %fact *]                cad(cage.p [%unsafe cage.p.cad])
  ==
::
++  unguard
  |%
  ++  card
    |=  cad=^card
    ^-  card:agent:gall
    ?<  ?=(%slip -.cad)
    ?+  cad  cad
      [%pass * %agent * %poke *]     cad(rail.task.q (de-rail rail.task.q.cad))
      [%pass * %agent * %poke-as *]  cad(rail.task.q (de-rail rail.task.q.cad))
      [%give %fact *]                cad(rail.p (de-rail rail.p.cad))
    ==
  ::
  ++  step
    |*  [caz=(list ^card) cor=*]
    ^-  [(list card:agent:gall) _cor]
    [(turn caz card) cor]
  ::
  ++  peek
    |=  ray=(unit (unit rail))
    ?.  ?=([~ ~ *] ray)  ray
    ``(de-rail u.u.ray)
  --
--

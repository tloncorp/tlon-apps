::  expose: one-release teardown for legacy clearweb pages
::
::  This replaces the retired renderer for one release.  Existing %expose
::  state records every page it installed in Eyre; on load, clear those pages
::  and remove the matching contacts metadata before this agent is deleted.
::
/-  c=cite, co=contacts
/+  default-agent, dbug, hutils, verb
::
|%
+$  card  card:agent:gall
+$  state-3  [%3]
+$  state-2
  $:  %2
      open=(set cite:c)
      eager=?
  ==
+$  state-1  [%1 open=(set cite:c)]
+$  state-0  [%0 open=(set cite:c)]
+$  versioned-state  $%(state-3 state-2 state-1 state-0)
::
++  e
  |%
  ++  clear-page
    |=  ref=cite:c
    ^-  card
    (store:hutils (cat 3 '/expose' (spat (print:c ref))) ~)
  ::
  ++  clear-contact-metadata
    |=  [our=@p now=@da]
    ^-  (unit card)
    ?.  .^(? %gu /(scot %p our)/(scot %da now)/contacts/$)
      ~
    =+  =>  [our=our now=now co=co ..lull]  ~+
        .^(orig=contact:co %gx /(scot %p our)/contacts/(scot %da now)/v1/self/contact-1)
    =/  cleaned  (~(del by orig) %expose-cites)
    ?:  =(orig cleaned)
      ~
    =/  =action:co  [%self cleaned]
    =/  =cage  [%contact-action-1 !>(action)]
    `[%pass /contacts/clear-expose %agent [our %contacts] %poke cage]
  ::
  ++  teardown-cards
    |=  open=(set cite:c)
    ^-  (list card)
    =/  pages=(list card)
      (turn ~(tap in open) clear-page)
    (weld pages (drop (clear-contact-metadata [our now]:bowl)))
  --
--
::
=|  state-3
=*  state  -
%-  agent:dbug
%^  verb  |  %warn
^-  agent:gall
|_  =bowl:gall
+*  this  .
    def   ~(. (default-agent this %.n) bowl)
::
++  on-init
  ^-  (quip card _this)
  [~ this]
::
++  on-save  !>(state)
++  on-load
  |=  =vase
  ^-  (quip card _this)
  =+  !<(old=versioned-state vase)
  =?  old  ?=(%0 -.old)  [%1 open.old]
  =?  old  ?=(%1 -.old)  [%2 open.old &]
  ?:  ?=(%3 -.old)
    [~ this]
  =.  state  [%3]
  [(teardown-cards:e open.old) this]
::
++  on-poke   on-poke:def
++  on-watch  on-watch:def
++  on-peek   on-peek:def
++  on-leave  on-leave:def
++  on-agent  on-agent:def
++  on-arvo   on-arvo:def
++  on-fail   on-fail:def
--

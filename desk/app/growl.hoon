/-  settings
/+  summarize, default-agent, verb, dbug
::
|%
+$  card  card:agent:gall
+$  state-1  [%1 enabled=_| bark-host=_~rilfet-palsum]
--
::
::  This agent should eventually go into landscape
::
=|  state-1
=*  state  -
%-  agent:dbug
%^  verb  |  %warn
^-  agent:gall
|_  =bowl:gall
+*  this  .
    def   ~(. (default-agent this %.n) bowl)
::
++  on-init
  =^  caz  this  (on-poke %initialize !>(~))
  :_  this
  ::NOTE  sadly, we cannot subscribe to items that may not exist right now,
  ::      so we subscribe to the whole bucket instead
  [[%pass /settings %agent [our.bowl %settings] %watch /desk/groups] caz]
::
++  on-save  !>(state)
++  on-load
  |=  old-state=vase
  |^  ^-  (quip card _this)
      =+  !<(old=versioned-state old-state)
      ?-  -.old
        ::  %0 lost sync with the flag so must re-set, but not scry during load
        ::
        %0  [[%pass /re-set %arvo %b %wait now.bowl]~ this]
        %1  [~ this(state old)]
      ==
  ::
  +$  versioned-state  $%(state-0 state-1)
  +$  state-0  [%0 enabled=_| bark-host=_~rilfet-palsum]
  --
::
++  on-poke
  |=  [=mark =vase]
  ^-  (quip card _this)
  ?+  mark  (on-poke:def mark vase)
      %noun
    =+  !<([m=@ n=*] vase)
    $(mark m, vase (need (slew 3 vase)))
  ::
      %set-host
    ?>  =(src.bowl our.bowl)
    `this(bark-host !<(ship vase))
  ::
      %initialize
    =;  consent=?
      $(mark ?:(consent %enable %disable), vase !>(~))
    =/  bap=path  /(scot %p our.bowl)/settings/(scot %da now.bowl)
    ?.  .^(? %gu (snoc bap %$))  |
    =+  .^(=data:settings %gx (weld bap /desk/groups/settings-data))
    ?>  ?=(%desk -.data)
    =;  =val:settings
      ?:(?=(%b -.val) p.val |)
    %+  %~  gut  by
        (~(gut by desk.data) %groups ~)
      'logActivity'
    [%b |]
  ::
      %enable
    :_  this(enabled %.y)
    ~[[%pass /add-recipient %agent [bark-host %bark] %poke %bark-add-recipient !>(our.bowl)]]
  ::
      %disable
    :_  this(enabled %.n)
    ~[[%pass /remove-recipient %agent [bark-host %bark] %poke %bark-remove-recipient !>(our.bowl)]]
  ::
      %growl-summarize
    ?.  enabled
      :_  this
      ~[[%pass /bark-summary %agent [bark-host %bark] %poke %bark-receive-summary !>(~)]]
    =/  requested  !<(time vase)
    =/  activity    ~(summarize-activity summarize [our now]:bowl)
    =/  inactivity  ~(summarize-inactivity summarize [our now]:bowl)
    :_  this
    ~[[%pass /bark-summary %agent [bark-host %bark] %poke %bark-receive-summary !>(`[requested %life activity inactivity])]]
  ==
::
++  on-agent
  |=  [=wire =sign:agent:gall]
  ^-  (quip card _this)
  ?.  ?=([%settings ~] wire)  (on-agent:def wire sign)
  ?-  -.sign
    %poke-ack  !!
  ::
      %watch-ack
    ?~  p.sign  [~ this]
    %-  (slog 'growl failed settings subscription' u.p.sign)
    [~ this]
  ::
      %kick
    [[%pass /settings %agent [our.bowl %settings] %watch /desk/groups]~ this]
  ::
      %fact
    ?.  =(%settings-event p.cage.sign)  (on-agent:def wire sign)
    =+  !<(=event:settings q.cage.sign)
    =/  new=(unit ?)
      =;  val=(unit val:settings)
        ?~  val  ~
        `?:(?=(%b -.u.val) p.u.val |)
      ?+  event  ~
        [%put-bucket %groups %groups *]  `(~(gut by bucket.event) 'logActivity' b+|)
        [%del-bucket %groups %groups]    `b+|
        [%put-entry %groups %groups %'logActivity' *]  `val.event
        [%del-entry %groups %groups %'logActivity']    `b+|
      ==
    ?~  new  [~ this]
    ?:  =(u.new enabled)  [~ this]
    (on-poke ?:(u.new %enable %disable) !>(~))
  ==
::
++  on-arvo
  |=  [=wire sign=sign-arvo]
  ^-  (quip card _this)
  ?>  =(/re-set wire)
  ?>  ?=(%wake +<.sign)
  (on-poke %initialize !>(~))
::
++  on-watch  on-watch:def
++  on-fail
  |=  [=term =tang]
  (mean ':sub +on-fail' term tang)
++  on-leave
  |=  =path
  `this
++  on-peek  on-peek:def
--

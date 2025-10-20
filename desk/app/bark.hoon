::  bark: gathers summaries from ships, sends emails to their owners
::
::    general flow is that bark gets configured with api keys and recipient
::    ships. on-demand, bark asks either all or a subset of recipients for
::    an activity summary (through the growl agent on their ships), and upon
::    receiving responses, uses the mailchimp api to upload the received
::    deets for that ship, and/or triggers an email send.
::
/+  default-agent, verb, dbug
::
|%
+$  card  card:agent:gall
+$  state-0
  $:  %0
      api=[tlon=@t mailchimp=[key=@t list-id=@t]]
      recipients=(set ship)
  ==
::
++  next-timer
  |=  now=@da
  ::  west-coast midnights for minimal ameri-centric disruption
  %+  add  ~d1.h7
  (sub now (mod now ~d1))
--
::
=|  state-0
=*  state  -
%-  agent:dbug
%^  verb  |  %warn
^-  agent:gall
|_  =bowl:gall
+*  this  .
    def   ~(. (default-agent this %.n) bowl)
++  on-init
  ^-  (quip card _this)
  :_  this
  [%pass /fetch %arvo %b %wait (next-timer now.bowl)]~
::
++  on-arvo
  |=  [=wire sign=sign-arvo]
  ^-  (quip card _this)
  ?+  wire  ~|([%strange-wire wire] !!)
      [%fetch ~]
    ?>  ?=(%wake +<.sign)
    =^  caz  this  (on-poke %bark-generate-summaries !>(~))
    :_  this
    :_  caz
    [%pass /fetch %arvo %b %wait (next-timer now.bowl)]
  ::
      [%save-summary @ @ ~]
    ?>  ?=(%arow +<.sign)
    ?:  ?=(%& -.p.sign)  [~ this]
    %-  (slog 'bark: failed to save summary' p.p.sign)
    [~ this]
  ==
::
++  on-poke
  |=  [=mark =vase]
  ^-  (quip card _this)
  ?+  mark  (on-poke:def mark vase)
      %noun
    =+  !<([m=@ n=*] vase)
    $(mark m, vase (need (slew 3 vase)))
  ::
      %set-tlon-api-key
    `this(tlon.api !<(@t vase))
    ::
      %set-mailchimp-api-key
    `this(mailchimp.api !<([key=@t list=@t] vase))
    ::
      %bark-add-recipient
    =+  !<(=ship vase)
    ?>  =(src.bowl ship)
    `this(recipients (~(put in recipients) ship))
    ::
      %bark-remove-recipient
    =+  !<(=ship vase)
    ?>  =(src.bowl ship)
    :_  this(recipients (~(del in recipients) ship))
    :_  ~
    :*  %pass  /save-summary/(scot %p src.bowl)/(scot %da now.bowl)
        %arvo  %k  %fard
        %landscape  %save-summary  %noun
        !>(`[tlon.api mailchimp.api src.bowl %wipe ~])
    ==
    ::
      %bark-generate-summaries
    ?>  =(src.bowl our.bowl)
    :_  this
    =-  ~(tap in -)
    ^-  (set card)
    %-  ~(run in recipients)
      |=  =ship
      ^-  card
      [%pass /request-summary %agent [ship %growl] %poke %growl-summarize !>(now.bowl)]
    ::
      %bark-target-summaries
    ?>  =(src.bowl our.bowl)
    :_  this
    %+  turn
      (skim !<((list ship) vase) ~(has in recipients))
    |=  =ship
    ^-  card
    [%pass /request-summary %agent [ship %growl] %poke %growl-summarize !>(now.bowl)]
    ::
      %bark-receive-summary
    =/  result
      !<  %-  unit
          $:  requested=time
          $=  summary
          ::NOTE  see also /lib/summarize
          $%  [%life active=[s=@ud r=@ud g=@t] inactive=[d=@ud c=@ud g=@t c=@t]]
          ==  ==
      vase
    ?~  result
      $(mark %bark-remove-recipient, vase !>(src.bowl))
    ::TODO  maybe drop the result (or re-request) if the timestamp is too old?
    :_  this
    :~  :*  %pass  /save-summary/(scot %p src.bowl)/(scot %da requested.u.result)
        %arvo  %k  %fard
        %landscape  %save-summary  %noun
        !>(`[tlon.api mailchimp.api src.bowl summary.u.result])
      ==
    ==
  ==
++  on-watch  on-watch:def
++  on-agent  on-agent:def
++  on-fail
  |=  [=term =tang]
  %-  (slog 'bark: on-fail' term tang)
  [~ this]
++  on-leave
  |=  =path
  `this
++  on-save  !>(state)
++  on-load
  |=  old-state=vase
  ^-  (quip card _this)
  =/  old  !<(state-0 old-state)
  `this(state old)
++  on-peek  on-peek:def
--

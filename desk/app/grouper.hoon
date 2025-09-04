/-  reel, gv=groups-ver, c=chat, ch=channels, story
/+  gj=groups-json, default-agent, verb, logs, dbug
::
|%
++  enabled-groups  (set cord)
++  outstanding-pokes  (set (pair ship cord))
++  bite-subscribe
  |=  =bowl:gall
  [%pass /bite-wire %agent [our.bowl %reel] %watch /bites]
+$  card  card:agent:gall
+$  versioned-state
  $%  state-2
      state-1
      state-0
  ==
+$  state-2  [%2 =enabled-groups =outstanding-pokes]
+$  state-1  [%1 =enabled-groups =outstanding-pokes]
+$  state-0  [%0 =enabled-groups]
::  |l: logging core
::
++  l
  |_  [our=ship flow=(unit @t) details=(list (pair @t json))]
  ++  fail
    |=  [desc=term trace=tang]
    =/  =card
      (~(fail logs our /logs) desc trace deez)
    %-  %-  %*(. slog pri 3)  [leaf+"fail" trace]
    (link card)
  ::
  ++  tell
    |=  [vol=volume:logs =echo:logs =log-data:logs]
    =/  =card
      (~(tell logs our /logs) vol echo (weld log-data deez))
    =/  pri
      ?-  vol
        %dbug  0
        %info  1
        %warn  2
        %crit  3
      ==
    %-  %-  %*(. slog pri pri)  echo
    (link card)
  ::  +deez: log message details
  ::
  ++  deez
    ^-  (list (pair @t json))
    =;  l=(list (unit (pair @t json)))
      (weld (murn l same) details)
    :~  ?~(flow ~ `%flow^s+u.flow)
    ==
  ++  link
    |=  =card
    |*  [caz=(list ^card) etc=*]
    :_  etc
    [card caz]
  --
--
::
=|  state-2
=*  state  -
%-  agent:dbug
%+  verb  |
^-  agent:gall
|_  =bowl:gall
+*  this  .
    def   ~(. (default-agent this %.n) bowl)
    log   ~(. l [our.bowl ~ ~])
::
++  on-init
  :_  this
  ~[(bite-subscribe bowl)]
++  on-poke
  |=  [=mark =vase]
  ^-  (quip card _this)
  ?+  mark  (on-poke:def mark vase)
    %leave  :_  this  ~[[%pass /bite-wire %agent [our.bowl %reel] %leave ~]]
  ::
      %watch
    :_  this
    ?:  (~(has by wex.bowl) [/bite-wire our.bowl %reel])  ~
    ~[(bite-subscribe bowl)]
  ::
      %grouper-enable
    =+  !<(name=cord vase)
    `this(enabled-groups (~(put in enabled-groups) name))
  ::
      %grouper-disable
    =+  !<(name=cord vase)
    `this(enabled-groups (~(del in enabled-groups) name))
  ::
      %grouper-ask-enabled
    =+  !<(name=cord vase)
    =/  enabled  (~(has in enabled-groups) name)
    :_  this
    ~[[%pass [%ask name ~] %agent [src.bowl %grouper] %poke %grouper-answer-enabled !>([name enabled])]]
  ::
      %grouper-answer-enabled
    =/  [name=cord enabled=?]  !<([cord ?] vase)
    :-  ~[[%give %fact ~[[%group-enabled (scot %p src.bowl) name ~]] %json !>(b+enabled)]]
    ?:  enabled
      this(enabled-groups (~(put in enabled-groups) name))
    this(enabled-groups (~(del in enabled-groups) name))
  ::
      %grouper-check-link
    =+  !<(=(pole knot) vase)
    ?>  ?=([%check-link rest=*] pole)
    =/  baseurl  .^(cord %gx /(scot %p our.bowl)/reel/(scot %da now.bowl)/service/noun)
    ::  it really is necessary to double-encode this, make sure we strip
    ::  the leading slash before encoding
    =/  end  (en-urlt:html (en-urlt:html +:(spud rest.pole)))
    =/  url
      ?.  =(baseurl 'https://tlon.network/lure/')
        (crip "{(trip baseurl)}{end}")
      (crip "https://tlon.network/v1/policies/lure/{end}")
    :_  this
    :~  :*  %pass  pole
          %arvo  %k  %fard
          q.byk.bowl  %lure-check-link  %noun
          !>(`[url pole])
        ==
    ==
  ::
      %grouper-link-checked
    =+  !<([good=? =path] vase)
    :_  this
    ~[[%give %fact ~[path] %json !>(b+good)]]
  ==
::
++  on-watch
  |=  =path
  ^-  (quip card _this)
  ?>  =(our.bowl src.bowl)
  ?+  path  (on-watch:def path)
      [%group-enabled @ @ ~]
    =/  target=ship  (slav %p i.t.path)
    =/  group=cord  i.t.t.path
    ?:  (~(has in outstanding-pokes) [target group])  `this
    :_  this(outstanding-pokes (~(put in outstanding-pokes) [target group]))
    :~  [%pass path %agent [target %grouper] %poke %grouper-ask-enabled !>(group)]
        [%pass /expire/(scot %p our.bowl)/[group] %arvo %b [%wait (add ~h1 now.bowl)]]
    ==
  ::
      [%check-link @ @ ~]
    :_  this
    ~[[%pass path %agent [our.bowl %grouper] %poke %grouper-check-link !>(path)]]
  ::
      [%v1 %check-link @ ~]
    =/  url  (slav %t i.t.t.path)
    :_  this
    :~  :*  %pass  path
          %arvo  %k  %fard
          q.byk.bowl  %lure-check-link  %noun
          !>(`[url path])
        ==
    ==
  ==
::
++  on-agent
  |=  [=wire =sign:agent:gall]
  ^-  (quip card _this)
  ?:  ?=([%logs ~] wire)  `this
  ?:  ?=([%group-enabled @ @ ~] wire)
    ?+  -.sign  (on-agent:def wire sign)
        %poke-ack
      `this(outstanding-pokes (~(del in outstanding-pokes) [src.bowl i.t.t.wire]))
    ==
  ?-  -.sign
      %poke-ack
    ?.  ?=([%dm ship=@ token=@ ~] wire)
      ?~  p.sign  `this
      %-  (slog leaf/"Poke failed {<wire>}" u.p.sign)
      `this
    =*  joiner  i.t.wire
    =*  token  i.t.t.wire
    ?~  p.sign
      %-  %^  tell:log  %info
          ~[leaf+"{<joiner>} invited to DM"]
        :~  'event'^s+'DM Invite Sent'
            'flow'^s+'lure'
            'lure-id'^s+token
            'lure-joiner'^s+joiner
        ==
      `this
    %-  %^  tell:log  %crit
        u.p.sign
      :~  'event'^s+'DM Invite Fail'
          'flow'^s+'lure'
          'lure-id'^s+token
          'lure-joiner'^s+joiner
      ==
    `this
  ::
      %watch-ack  `this
  ::
      %kick
    :_  this
    ~[(bite-subscribe bowl)]
  ::
      %fact
    =+  !<(=bite:reel q.cage.sign)
    ?>  ?=([%bite-2 *] bite)
    =/  details=(list (pair @t json))
      :~  'lure-id'^s+token.bite
          'lure-joiner'^s+(scot %p joiner.bite)
      ==
    =+  log=~(. l our.bowl `'lure' details)
    =>
      |%
      ++  tell
        |=  [=volume:logs event=@t =echo:logs]
        %^    tell:log
            volume
          echo
        ~['event'^s+event]
      --
    =^  caz=(list card)  this
      =*  dm-event  'DM Invite Fail'
      ?~  inviter=(~(get by fields.metadata.bite) 'inviterUserId')
        %-  %^  tell  %crit  dm-event
            ~['inviter field missing in lure bite']
        `this
      ?.  =((slav %p u.inviter) our.bowl)
        %-  %^  tell  %crit  dm-event
            ~[leaf+"inviter {<u.inviter>} is foreign"]
        `this
      =/  wir=^wire  /dm/(scot %p joiner.bite)/[token.bite]
      =/  =dock  [our.bowl %chat]
      =/  =id:c  [our now]:bowl
      =/  =memo:ch
        [~[[%inline ~[[%ship joiner.bite] ' has joined the network']]] id]
      =/  =action:dm:c
        :-  joiner.bite
        [id %add %*(. *essay:ch - memo, kind [%chat %notice ~]) ~]
      =/  =cage  chat-dm-action-1+!>(`action:dm:c`action)
      :_  this
      [%pass wir %agent dock %poke cage]~
    ::
    =+  invite-type=(~(get by fields.metadata.bite) 'inviteType')
    ::
    ::  don't send group invite if this is a personal bite
    ?:  &(?=(^ invite-type) =('user' u.invite-type))
      [caz this]
    =*  group-event  'Group Invite Fail'
    ?~  group=(~(get by fields.metadata.bite) 'group')
      %-  (tell %warn group-event 'group field missing' ~)
      [caz this]
    =/  =flag:gv  (flag:dejs:gj s+u.group)
    ?.  (~(has in enabled-groups) q.flag)
      %-  %^    tell
              %warn  
            group-event
          ~[leaf+"invites for group {<p.flag>}/{(trip q.flag)} not enabled"]
      [caz this]
    =/  prefix  /(scot %p our.bowl)/groups/(scot %da now.bowl)
    ?.  .^(? %gu (weld prefix /$))
      %-  (tell %warn group-event '%groups not running' ~)
      [caz this]
    ?.  .^(? %gu (weld prefix /groups/(scot %p p.flag)/[q.flag]))
      %-  %^    tell
              %warn  
            group-event
          ~[leaf+"group {<p.flag>}/{(trip q.flag)} missing"]
      [caz this]
    %-  %^    tell
            %info  
          'Group Invite Sent'
        ~[leaf+"{<joiner.bite>} invited to group {<p.flag>}/{(trip q.flag)}"]
    =/  =a-groups:v7:gv
      =/  note=story:story
        ~[inline+~[(crip "lure invite {<token.bite>}")]]
      [%invite flag [joiner.bite ~ `note]]
    :_  this
    :_  caz
    [%pass /invite %agent [our.bowl %groups] %poke group-action-4+!>(a-groups)]
  ==
::
++  on-fail
  |=  [=term =tang]
  ^-  (quip card _this)
  %-  (fail:log term tang)
  `this
::
++  on-leave
  |=  =path
  `this
::
++  on-save  !>(state)
::
++  on-load
  |=  old-state=vase
  ^-  (quip card _this)
  =/  old  !<(versioned-state old-state)
  ?-  -.old
      %2
    :_  this(state old)
    ?:  (~(has by wex.bowl) [/bite-wire our.bowl %reel])  ~
    ~[(bite-subscribe bowl)]
      %1
    `this(state [%2 enabled-groups.old ~])
      %0
    `this(state *state-2)
  ==
::
++  on-arvo
  |=  [=wire =sign-arvo]
  ^-  (quip card _this)
  ?+  wire  (on-arvo:def wire sign-arvo)
      [%expire @ @ ~]
    ?+  sign-arvo  (on-arvo:def wire sign-arvo)
        [%behn %wake *]
      =/  target  (slav %p i.t.wire)
      =/  group   i.t.t.wire
      ?~  error.sign-arvo
        `this(outstanding-pokes (~(del in outstanding-pokes) [target group]))
      (on-arvo:def wire sign-arvo)
    ==
  ==
::
++  on-peek
  |=  =path
  ^-  (unit (unit cage))
  ?+  path  [~ ~]
      [%x %enabled @ ~]
    ``json+!>([%b (~(has in enabled-groups) i.t.t.path)])
  ==
--

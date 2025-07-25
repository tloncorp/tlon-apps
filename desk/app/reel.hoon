/-  reel
/+  default-agent, verb, dbug, logs, *reel
|%
+$  card  card:agent:gall
+$  versioned-state
  $%  state-0
      state-1
      state-2
      state-3
      state-4
  ==
::
::  vic: URL of bait service
::  civ: @p of bait service
::  our-metadata: a mapping from nonce/token to metadata
::  open-link-requests: open requests for an existing foreign link, v0
::                      lure links only
::  open-describes: attempts to create a link waiting to be assigned a token
::  stable-id: a mapping from something the client can use to identify the
::             metadata to nonce and/or token
::
+$  state-0
  $:  %0
      vic=@t
      civ=ship
      descriptions=(map cord cord)
  ==
+$  state-1
  $:  %1
      vic=@t
      civ=ship
      our-metadata=(map cord metadata:reel)
  ==
+$  state-2
  $:  %2
      vic=@t
      civ=ship
      our-metadata=(map cord metadata:reel)
      outstanding-pokes=(set (pair ship cord))
  ==
+$  state-3
  $:  %3
      vic=@t
      civ=ship
      our-metadata=(map cord metadata:reel)
      outstanding-pokes=(set (pair ship cord))
  ==
+$  state-4
  $:  %4
      vic=@t
      civ=ship
      our-metadata=(map token:reel metadata:reel)
      open-link-requests=(set (pair ship cord))
      open-describes=(set token:reel)
      stable-id=(map cord token:reel)
  ==
++  flag  ;~((glue fas) ;~(pfix sig fed:ag) sym)
::  url with old style token
++  url-for-token
  |=  [vic=cord token=cord]
  (cat 3 vic token)
--
=|  state-4
=*  state  -
::
%-  agent:dbug
%+  verb  |
|_  =bowl:gall
+*  this  .
    def   ~(. (default-agent this %|) bowl)
    log   ~(. logs [our.bowl /logs])
::
++  on-init
  ^-  (quip card _this)
  `this(vic 'https://tlon.network/lure/', civ ~loshut-lonreg)
::
++  on-save  !>(state)
++  on-load
  |=  old-state=vase
  ^-  (quip card _this)
  =/  old  !<(versioned-state old-state)
  ?-  -.old
      %4
    =.  state  old
    =^  new-md  stable-id
      %+  roll
        ~(tap by our-metadata)
      |=  [[=token:reel =metadata:reel] [md=_our-metadata id=_stable-id]]
      ?^  (slaw %uv token)  [md id]
      ?^  (rush token flag)
        :-  md
        ?:  (~(has by id) token)  id
        (~(put by id) token token)
      =/  new  (rap 3 (scot %p our.bowl) '/' token ~)
      :-  (~(put by md) new metadata)
      (~(put by id) new new)
    `this(our-metadata new-md)
      %3
    `this(state [%4 vic.old civ.old our-metadata.old outstanding-pokes.old ~ ~])
      %2
    `this(state [%4 vic.old civ.old our-metadata.old ~ ~ ~])
      %1
    `this(state [%4 'https://tlon.network/lure/' ~loshut-lonreg ~ ~ ~ ~])
      %0
    `this(state [%4 'https://tlon.network/lure/' ~loshut-lonreg ~ ~ ~ ~])
  ==
::
++  on-poke
  |=  [=mark =vase]
  ^-  (quip card _this)
  ?+    mark  (on-poke:def mark vase)
      %reel-command
    ?>  =(our.bowl src.bowl)
    =+  !<(=command:reel vase)
    ?-  -.command
        %set-service
      :_  this(vic vic.command)
      ~[[%pass /set-ship %arvo %k %fard q.byk.bowl %reel-set-ship %noun !>(vic.command)]]
        %set-ship
      ::  since we're changing providers, we need to regenerate links
      ::  we'll use whatever key we currently have as the nonce
      :_  this(civ civ.command, open-describes ~(key by our-metadata))
      %+  turn  ~(tap by our-metadata)
      |=  [token=cord =metadata:reel]
      ^-  card
      [%pass /describe %agent [civ %bait] %poke %bait-describe !>([token metadata])]
    ==
  ::
      %reel-bite
    ?>  =(civ src.bowl)
    =+  !<(=bite:reel vase)
    [[%give %fact ~[/bites] mark !>(bite)]~ this]
  ::
      %reel-describe
    ?>  =(our.bowl src.bowl)
    =+  !<([id=cord =metadata:reel] vase)
    =/  old-token  (~(get by stable-id) id)
    =.  fields.metadata
      %-  ~(gas by fields.metadata)
      :~  ['bite-type' '2']
          ['inviter' (scot %p src.bowl)]
          ['group' id]
      ==
    ::  the nonce here is a temporary identifier for the metadata
    ::  a new one will be assigned by the bait provider and returned to us
    =/  =nonce:reel  (scot %da now.bowl)
    ::  delete old metadata if we have an existing token for this id
    =?  our-metadata  ?=(^ old-token)
      (~(del by our-metadata) u.old-token)
    =.  our-metadata  (~(put by our-metadata) nonce metadata)
    =.  open-describes  (~(put in open-describes) nonce)
    =.  stable-id  (~(put by stable-id) id nonce)
    :_  this
    ~[[%pass /describe %agent [civ %bait] %poke %bait-describe !>([nonce metadata])]]
  ::
      %reel-confirmation
    ?>  =(civ src.bowl)
    =+  !<(confirmation:reel vase)
    =.  open-describes  (~(del in open-describes) nonce)
    =/  ids=(list [id=cord =token:reel])
      %+  skim
        ~(tap by stable-id)
      |=  [key=cord =token:reel]
      =(nonce token)
    ?~  ids
      :_  this  :_  ~
      %^  tell:log  %warn
        ~[leaf+"no stable id found for nonce {<nonce>}"]
      ~['event'^s+'Nonce Revoked' 'flow'^s+'lure']
    =*  id  -<.ids
    ?~  md=(~(get by our-metadata) nonce)
      :_  this  :_  ~
      %^  tell:log  %crit
        ~[leaf+"no metadata for nonce {<nonce>}"]
      ~['event'^s+'Invite Creation Failed' 'flow'^s+'lure']
    ::  update the token the id points to
    =.  stable-id  (~(put by stable-id) id token)
    ::  swap out the nonce for the token in our-metadata
    =.  our-metadata
      (~(put by (~(del by our-metadata) nonce)) token u.md)
    :_  this
    =/  url  (cat 3 vic token)
    =/  path  (stab (cat 3 '/v1/id-link/' id))
    :-  %^  tell:log  %info
          ~[leaf+"invite link for {(trip id)} created"]
        ~['event'^s+'Invite Link Created' 'flow'^s+'lure' 'lure-id'^s+token]
    ~[[%give %fact ~[path] %json !>(s+url)]]
  ::
      %reel-undescribe
    ?>  =(our.bowl src.bowl)
    =+  !<(=token:reel vase)
    ::  the token here should be the actual token given to us by the provider
    :_  this(our-metadata (~(del by our-metadata) token))
    :-  %^  tell:log  %info
          ~[leaf+"invite link removed"]
        ~['event'^s+'Invite Link Removed' 'flow'^s+'lure' 'lure-id'^s+token]
    ~[[%pass /undescribe %agent [civ %bait] %poke %bait-undescribe !>(token)]]
  ::  old pokes for getting links, we no longer use these because all links
  ::  are unique to that ship/user and can be scried out
  ::
      %reel-want-token-link
    =+  !<(=token:reel vase)
    :_  this
    =/  full-token
      ?^  (rush token flag)  token
      (rap 3 (scot %p our.bowl) '/' token ~)
    =/  result=(unit [cord cord])
      ?.  (~(has by our-metadata) full-token)  `[full-token '']
      `[full-token (url-for-token vic full-token)]
    ~[[%pass [%token-link-want token ~] %agent [src dap]:bowl %poke %reel-give-token-link !>(result)]]
      %reel-give-token-link
    =+  !<(result=(unit [cord cord]) vase)
    ?~  result  `this
    :_  this
    =/  [token=cord url=cord]  u.result
    =/  path  (stab (cat 3 '/token-link/' token))
    ~[[%give %fact ~[path] %json !>(?:(=('' url) ~ s+url))]]
  ==
::
++  on-agent
  |=  [=wire =sign:agent:gall]
  ^-  (quip card _this)
  =/  =(pole knot)  wire
  ?+  pole  (on-agent:def wire sign)
      [%token-link @ name=@ ~]
    ?+  -.sign  (on-agent:def wire sign)
        %poke-ack
      `this(open-link-requests (~(del in open-link-requests) [src.bowl name.pole]))
    ==
  ==
::
++  on-watch
  |=  =(pole knot)
  ^-  (quip card _this)
  ?>  =(our.bowl src.bowl)
  =/  any  ?(%v0 %v1)
  =?  pole  !?=([any *] pole)
    [%v0 pole]
  ?+  pole  ~|("bad pole: {<pole>}" (on-watch:def pole))
    [any %bites ~]  `this
  ::  old subscription for getting links, we no longer use these because all
  ::  links are unique to that ship/user and can be scried out
  ::
      [%v0 %token-link ship=@ token=@ ~]
    =/  ship  (slav %p ship.pole)
    =/  key  [ship token.pole]
    ?~  (~(has in open-link-requests) key)  `this
    :_  this(open-link-requests (~(put in open-link-requests) key))
    =/  =dock  [ship dap.bowl]
    =/  =cage  reel-want-token-link+!>(token.pole)
    :~  [%pass +.pole %agent dock %poke cage]
        [%pass /expire/[ship.pole]/[token.pole] %arvo %b [%wait (add ~h1 now.bowl)]]
    ==
  ::
      [%v1 %id-link id=*]
    =/  id  (crip +:(spud id.pole))
    ?~  token=(~(get by stable-id) id)  `this
    ?:  (~(has in open-describes) u.token)
      ::  when the confirmation comes back we'll send the fact
      `this
    =/  url  (cat 3 vic u.token)
    :_  this
    ~[[%give %fact ~ %json !>(s+url)]]
  ==
::
++  on-leave  on-leave:def
++  on-peek
  |=  =(pole knot)
  ^-  (unit (unit cage))
  =/  any  ?(%v0 %v1)
  =?  +.pole  !?=([any *] +.pole)
    [%v0 +.pole]
  ?+  pole  [~ ~]
    [%x any %service ~]  ``noun+!>(vic)
    [%x any %bait ~]  ``reel-bait+!>([vic civ])
  ::
      [%x %v0 %outstanding-poke ship=@ name=@ ~]
    =/  has  (~(has in open-link-requests) [(slav %p ship.pole) name.pole])
    ``json+!>([%b has])
  ::
      [%x %v1 %metadata ship=@ name=@ ~]
    =/  id  (rap 3 ship.pole '/' name.pole ~)
    =/  token  (~(get by stable-id) id)
    ?~  token  [~ ~]
    =/  =metadata:reel  (fall (~(get by our-metadata) u.token) *metadata:reel)
    ``reel-metadata+!>(metadata)
  ::
      [%x %v0 %metadata name=@ ~]
    ::  old style tokens are directly in metadata
    =/  id  (rap 3 (scot %p our.bowl) '/' name.pole ~)
    =/  =metadata:reel  (fall (~(get by our-metadata) id) *metadata:reel)
    ``reel-metadata+!>(metadata)
  ::
      [%x any %token-url token=*]
    =/  =token:reel  (crip +:(spud token.pole))
    =/  url  (url-for-token vic token)
    ``json+!>(s+url)
  ::
      [%x %v1 %id-url id=*]
    =/  id  (crip +:(spud id.pole))
    ?~  token=(~(get by stable-id) id)
      ``json+!>(s+'')
    =/  url  (cat 3 vic u.token)
    ``json+!>(s+url)
  ==
::
++  on-arvo
  |=  [=wire =sign-arvo]
  ^-  (quip card:agent:gall _this)
  ?+  wire  (on-arvo:def wire sign-arvo)
      [%set-ship ~]
    ?>  ?=([%khan %arow *] sign-arvo)
    ?:  ?=(%.n -.p.sign-arvo)
      :_  this
      ~[(tell:log %warn ~['fetch bait ship failed'] ~)]
    `this
  ::
      [%expire @ @ ~]
    ?+  sign-arvo  (on-arvo:def wire sign-arvo)
        [%behn %wake *]
      =/  target  (slav %p i.t.wire)
      =/  group   i.t.t.wire
      ?~  error.sign-arvo
        :_  this(open-link-requests (~(del in open-link-requests) [target group]))
        =/  path  (welp /token-link t.wire)
        ~[[%give %kick ~[path] ~]]
      (on-arvo:def wire sign-arvo)
    ==
  ==
++  on-fail
  |=  [=term =tang]
  ^-  (quip card _this)
  :_  this
  [(fail:log term tang ~)]~
--

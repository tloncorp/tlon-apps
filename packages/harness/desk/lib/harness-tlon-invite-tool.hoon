::  Shareable group invite links, as the production CLI makes them. %reel
::  mints a token through the invite provider ship and keeps one per group;
::  the first call asks for it, a later call returns the link and enables
::  %grouper, which admits people who arrive through it.
/-  g=groups-ver, reel
/+  spec=harness-tlon-tool, group-tool=harness-tlon-group-tool,
    policy=harness-tlon-group-policy
|_  bowl=bowl:gall
+$  result  [body=@t effect=(unit card:agent:gall)]
::
++  handles
  |=  action=@t
  =('create_invite_link' action)
::
++  run
  |=  [args=json wire=wire]
  ^-  result
  =/  flag  (flag:spec (required:spec args 'group' 256))
  =/  group  (~(get by groups:~(. group-tool bowl)) flag)
  ?~  group  ['error: this ship is not in that group; use list_groups' ~]
  ?.  ?|  ?=(%public privacy.admissions.u.group)
          (admin:policy our.bowl -.flag u.group)
      ==
    ['error: a link to a private or secret group needs the group host or an admin' ~]
  =/  agent  /(scot %p our.bowl)/reel/(scot %da now.bowl)
  ?.  .^(? %gu (weld agent /$))  ['error: invite links need %reel, which is not running here' ~]
  =/  id  (rap 3 (scot %p -.flag) '/' +.flag ~)
  =/  url  .^(json %gx :(weld agent /v1/id-url (stab (cat 3 '/' id)) /json))
  ?>  ?=(%s -.url)
  =/  token  (last-segment p.url)
  ?:  =('0v' (end 3^2 token))
    :_  `[%pass wire %agent [our.bowl %grouper] %poke %grouper-enable !>(`cord`+.flag)]
    %-  en:json:html
    %-  pairs:enjs:format
    :~  ['link' %s (cat 3 'https://invite.tlon.io/' token)]
        ['note' %s 'Anyone with the link can ask to join; private groups still need approval.']
    ==
  ::  A nonce, not a token: %reel is still waiting on the provider.
  ?:  =('~' (end 3 token))
    :_  ~
    'pending: the invite link is still being made; call create_invite_link again in a few seconds'
  =/  =metadata:v1:reel  [%groups-0 (my ~[[%'inviteType' 'group']])]
  :_  `[%pass wire %agent [our.bowl %reel] %poke %reel-describe !>([id metadata])]
  'accepted: asked for an invite link; call create_invite_link again in a few seconds for it'
::
++  last-segment
  |=  url=@t
  ^-  @t
  =/  text  (trip url)
  =/  slash  (find "/" (flop text))
  ?~  slash  url
  (crip (slag (sub (lent text) u.slash) text))
--

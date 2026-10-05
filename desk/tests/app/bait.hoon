/-  reel
/+  *test-agent, test
/=  bait-agent  /app/bait
|%
++  dap  %bait-test
+$  state-2
  $:  %2
      token-metadata=(map token:reel metadata:v0:reel)
  ==
+$  state-4
  $:  %4
      pending=(unit [tokens=(map token:reel metadata:v1:reel) ids=(jug cord token:reel) secret=@t])
  ==
++  group-invite-meta
  ^~
  ^-  metadata:v1:reel
  :-  %group-0
  %-  my
  :~  [%'inviterUserId' '~sampel-palnet']
      [%'invitedGroupTitle' 'Sunrise']
      [%'invitedGroupId' '~sampel-palnet/sunrise']
      [%'bite-type' '2']
  ==
::  +test-load-migrates-and-imports: old state reaches %reel as state-3
::
::  the v2 -> v3 migration still runs, so the import carries the
::  stable-id index: a group with two links, and no index entry for
::  the personal link. the 0v2 link's old 'group' field is migrated.
::
++  test-load-migrates-and-imports
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  =/  old=state-2
    :-  %2
    %-  my
    :~  :-  ~.0v1
        :-  %group-0
        %-  my
        :~  'invitedGroupTitle'^'Sunrise'
            'invitedGroupId'^'~sampel-palnet/sunrise'
        ==
      ::
        :-  ~.0v2
        :-  %group-0
        %-  my
        :~  'title'^'Sunrise'
            'group'^'~sampel-palnet/sunrise'
        ==
      ::
        :-  ~.0v3
        :-  %group-0
        %-  my
        :~  'inviterUserId'^'~sampel-palnet'
            'invitedGroupId'^'~zod/personal-invite-link'
            'inviteType'^'user'
        ==
    ==
  ;<  =bowl  bind:m  get-bowl
  ;<  *  bind:m  (do-init dap bait-agent)
  ;<  caz=(list card)  bind:m  (do-load bait-agent `!>(old))
  ;<  ~  bind:m  (ex-cards caz ~[(ex-poke-wire /import)])
  ;<  save=vase  bind:m  get-save
  =+  !<(new=state-4 save)
  ?>  ?=(^ pending.new)
  =*  imp  u.pending.new
  ;<  ~  bind:m
    %+  ex-equal  !>((~(get by ids.imp) '~sampel-palnet/sunrise'))
    !>(`(unit (set token:reel))`[~ (sy ~.0v1 ~.0v2 ~)])
  ;<  ~  bind:m
    %+  ex-equal  !>((~(get by ids.imp) '~zod/personal-invite-link'))
    !>(`(unit (set token:reel))`~)
  ;<  ~  bind:m
    %+  ex-equal  !>((~(get by fields:(~(got by tokens.imp) ~.0v2)) %'invitedGroupId'))
    !>(`(unit @t)``'~sampel-palnet/sunrise')
  ;<  *  bind:m  (do-agent /import [our.bowl %reel] %poke-ack ~)
  ;<  save=vase  bind:m  get-save
  (ex-equal save !>([%4 ~]))
::  +test-forward: remote provider pokes reach %reel with their sender
::
++  test-forward
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  =bowl  bind:m  get-bowl
  ;<  *  bind:m  (do-init dap bait-agent)
  ;<  ~  bind:m  (set-src ~dev)
  =/  =cage  bait-describe+!>([~.n1 group-invite-meta])
  ;<  caz=(list card)  bind:m  (do-poke cage)
  =/  fwd  `[%forward ship ^cage]`[%forward ~dev cage]
  ;<  ~  bind:m
    (ex-cards caz ~[(ex-poke /forward [our.bowl %reel] %noun !>(fwd))])
  ::  only the provider protocol is accepted from other ships
  ::
  (ex-fail (do-poke %bind-slash !>(~)))
--

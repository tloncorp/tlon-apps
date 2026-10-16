/-  spider, g=groups, gv=groups-ver
/+  *ph-io, *ph-test
=,  strand=strand:spider
|%
++  my-test-flag  ~zod^%my-test-group
::  +ex-r-groups: expect group response
::
++  ex-r-groups
  |=  [=ship =r-groups:v10:gv]
  =/  m  (strand ,~)
  ^-  form:m
  ;<  ~  bind:m
    %^  (ex-app-fact-match r-groups:v10:gv)  /(scot %p ship)/groups/v1/groups
      [ship %groups]
    :-  %group-response-1
    |=  rep=r-groups:v10:gv
    ;<  ~  bind:m  (ex-equal !>(flag.rep) !>(flag.r-groups))
    (ex-equal !>(r-group.rep) !>(r-group.r-groups))
  (pure:m ~)
::  +ex-r-groups-fact-match-tag: expect matching group response fact tag
::
++  ex-r-groups-fact-match-tag
  |=  [=ship =flag:gv tag=@tas]
  =/  m  (strand ,~)
  ^-  form:m
  ;<  ~  bind:m
    %^  (ex-app-fact-match r-groups:v10:gv)  /(scot %p ship)/groups/v1/groups
      [ship %groups]
    :-  %group-response-1
    |=  rep=r-groups:v10:gv
    ;<  ~  bind:m  (ex-equal !>(flag.rep) !>(flag))
    (ex-equal !>(`@tas`-.r-group.rep) !>(tag))
  (pure:m ~)
::  +create-test-group: create a group on .host
::
++  create-test-group
  |=  [host=ship =privacy:g members=(jug ship role-id:g)]
  =/  m  (strand ,~)
  ^-  form:m
  =/  =create-group:g
    :*  %my-test-group
        ['My Test Group' 'My testing group' '' '']
        privacy
        [~ ~]
        members
    ==
  (poke-app [host %groups] group-command+[%create create-group])
::  +join-test-group: let .joiner join the test group hosted by .host
::
++  join-test-group
  |=  [joiner=ship host=ship]
  =/  m  (strand ,~)
  ^-  form:m
  =/  =flag:gv  host^%my-test-group
  ;<  =bowl:strand  bind:m  get-bowl
  =/  aqua-pax
    /gx/(scot %p joiner)/groups/(scot %da now.bowl)/v2/foreigns/(scot %p host)/my-test-group/noun
  ;<  foreign=(unit foreign:v10:gv)  bind:m
    (scry-aqua (unit foreign:v10:gv) joiner aqua-pax)
  =/  token=(unit token:g)
    ?~  foreign  ~
    ?~  invites.u.foreign  ~
    token.i.invites.u.foreign
  =/  =a-foreigns:v8:gv  [%foreign flag %join token]
  ;<  ~  bind:m  (poke-app [joiner %groups] group-foreign-2+a-foreigns)
  (pure:m ~)
::  +ex-group-preview: expect a group preview
::
++  ex-group-preview
  |=  [viewer=ship =flag:gv meta=data:meta:g]
  =/  m  (strand ,~)
  ^-  form:m
  ;<  ~  bind:m
    %^  (ex-app-fact-match preview-update:v10:gv)
      /(scot %p viewer)/groups/v1/foreigns/(scot %p p.flag)/[q.flag]/preview
      [viewer %groups]
    :-  %group-preview-3
    |=  update=preview-update:v10:gv
    ?>  ?=(^ update)
    ;<  ~  bind:m  (ex-equal !>(flag.u.update) !>(flag))
    (ex-equal !>(meta.u.update) !>(meta))
  (pure:m ~)
::  +ex-foreign-invite-valid: expect a foreign invite with validity
::
++  ex-foreign-invite-valid
  |=  [=ship =flag:gv inviter=ship valid=?]
  =/  m  (strand ,~)
  ^-  form:m
  ;<  ~  bind:m
    %^  (ex-app-fact-match foreigns:v8:gv)  /(scot %p ship)/groups/v1/foreigns
      [ship %groups]
    :-  %foreigns-1
    |=  =foreigns:v8:gv
    =/  foreign  (~(got by foreigns) flag)
    ?>  ?=(^ invites.foreign)
    ;<  ~  bind:m  (ex-equal !>(from.i.invites.foreign) !>(inviter))
    (ex-equal !>(valid.i.invites.foreign) !>(valid))
  (pure:m ~)
::  +wait-for-r-group: wait for a matching group response
::
::  skips the responses on .ship's /v1/groups wire until one for
::  .flag satisfies .ok, and produces it.
::
++  wait-for-r-group
  |=  [=ship =flag:gv ok=$-(r-group:v10:gv ?)]
  =/  m  (strand ,r-group:v10:gv)
  ^-  form:m
  |-
  =*  loop  $
  ;<  rep=r-groups:v10:gv  bind:m
    %^  wait-for-app-fact-value  r-groups:v10:gv
      /(scot %p ship)/groups/v1/groups
    [ship %groups]
  ?.  &(=(flag flag.rep) (ok r-group.rep))
    loop
  (pure:m r-group.rep)
::  +ex-r-groups-token-del: expect a token deletion response
::
::  takes the next response on .ship's /v1/groups wire, expects it
::  to delete a token of .flag, and produces the token.
::
++  ex-r-groups-token-del
  |=  [=ship =flag:gv]
  =/  m  (strand ,token:g)
  ^-  form:m
  ;<  rep=r-groups:v10:gv  bind:m
    %^  wait-for-app-fact-value  r-groups:v10:gv
      /(scot %p ship)/groups/v1/groups
    [ship %groups]
  ;<  ~  bind:m  (ex-equal !>(flag.rep) !>(flag))
  =/  r=r-group:v10:gv  r-group.rep
  ;<  ~  bind:m  (ex-equal !>(`@tas`-.r) !>(%entry))
  ?>  ?=(%entry -.r)
  ;<  ~  bind:m  (ex-equal !>(`@tas`-.r-entry.r) !>(%token))
  ?>  ?=(%token -.r-entry.r)
  ;<  ~  bind:m  (ex-equal !>(`@tas`-.r-token.r-entry.r) !>(%del))
  ?>  ?=(%del -.r-token.r-entry.r)
  (pure:m token.r-token.r-entry.r)
::  +wait-for-token-add: wait for a personal token addition
::
::  skips the responses on .ship's /v1/groups wire until one adds a
::  personal token of .flag owned by .owner, and produces the token.
::
++  wait-for-token-add
  |=  [=ship =flag:gv owner=ship]
  =/  m  (strand ,token:g)
  ^-  form:m
  ;<  r=r-group:v10:gv  bind:m
    %^  wait-for-r-group  ship  flag
    |=  r=r-group:v10:gv
    ?.  ?=(%entry -.r)  |
    ?.  ?=(%token -.r-entry.r)  |
    ?.  ?=(%add -.r-token.r-entry.r)  |
    =([%personal owner] scheme.meta.r-token.r-entry.r)
  ?>  ?=(%entry -.r)
  ?>  ?=(%token -.r-entry.r)
  ?>  ?=(%add -.r-token.r-entry.r)
  (pure:m token.r-token.r-entry.r)
::  +wait-for-foreign: wait for a matching foreign group update
::
::  skips the updates on .ship's /v1/foreigns wire until one for
::  .flag satisfies .ok, and produces its foreign group.
::
++  wait-for-foreign
  |=  [=ship =flag:gv ok=$-(foreign:v8:gv ?)]
  =/  m  (strand ,foreign:v8:gv)
  ^-  form:m
  |-
  =*  loop  $
  ;<  =foreigns:v8:gv  bind:m
    %^  wait-for-app-fact-value  foreigns:v8:gv
      /(scot %p ship)/groups/v1/foreigns
    [ship %groups]
  =/  far=(unit foreign:v8:gv)  (~(get by foreigns) flag)
  ?~  far  loop
  ?.  (ok u.far)  loop
  (pure:m u.far)
::  +scry-test-group: scry .on's copy of the test group hosted by .host
::
++  scry-test-group
  |=  [on=ship host=ship]
  =/  m  (strand ,group:v11:gv)
  ^-  form:m
  ;<  =bowl:strand  bind:m  get-bowl
  =/  aqua-pax
    /gx/(scot %p on)/groups/(scot %da now.bowl)/v3/groups/(scot %p host)/my-test-group/noun
  ;<  group=(unit group:v11:gv)  bind:m
    (scry-aqua (unit group:v11:gv) on aqua-pax)
  ;<  ~  bind:m  (ex-equal !>(?=(^ group)) !>(&))
  ?>  ?=(^ group)
  (pure:m u.group)
::  +scry-test-foreign: scry .on's foreign record of the test group hosted by .host
::
++  scry-test-foreign
  |=  [on=ship host=ship]
  =/  m  (strand ,(unit foreign:v10:gv))
  ^-  form:m
  ;<  =bowl:strand  bind:m  get-bowl
  =/  aqua-pax
    /gx/(scot %p on)/groups/(scot %da now.bowl)/v2/foreigns/(scot %p host)/my-test-group/noun
  (scry-aqua (unit foreign:v10:gv) on aqua-pax)
::  +ex-invited: expect .ship to be (or not be) invited on .on
::
::  checks whether .on's copy of the test group hosted by .host
::  records .ship in its invited admissions.
::
++  ex-invited
  |=  [on=ship host=ship =ship invited=?]
  =/  m  (strand ,~)
  ^-  form:m
  ;<  =group:v11:gv  bind:m  (scry-test-group on host)
  (ex-equal !>((~(has by invited.admissions.group) ship)) !>(invited))
::  +personal-tokens: personal tokens issued to .ship in .group
::
++  personal-tokens
  |=  [=group:v11:gv =ship]
  ^-  (set token:g)
  %-  ~(gas in *(set token:g))
  %+  murn  ~(tap by tokens.admissions.group)
  |=  [tok=token:g meta=token-meta:g]
  ?.  ?=(%personal -.scheme.meta)  ~
  ?.  =(ship ship.scheme.meta)  ~
  `tok
::  +ph-test-group-join-secret: test secret group joins
::
::  scenario
::
::  ~zod hosts a secret group and sends an invitation to ~bud.
::  ~bud receives the invitation and joins the group successfully,
::  receiving the group creation fact.
::
++  ph-test-group-join-secret
  =/  m  (strand ,~)
  ^-  form:m
  ;<  ~  bind:m  (watch-app /~bud/groups/v1/groups [~bud %groups] /v1/groups)
  ;<  ~  bind:m  (watch-app /~bud/groups/v1/foreigns [~bud %groups] /v1/foreigns)
  ::
  ;<  ~  bind:m  (create-test-group ~zod %secret (my ~bud^~ ~))
  ::  ~bud waits for group invitation and joins the group
  ::
  ;<  *  bind:m  (wait-for-app-fact /~bud/groups/v1/foreigns [~bud %groups])
  ;<  ~  bind:m  (join-test-group ~bud ~zod)
  ;<  ~  bind:m  (ex-r-groups-fact-match-tag ~bud ~zod^%my-test-group %create)
  (pure:m ~)
::  +ph-test-group-join-private-invite: test private group member invites
::
::  scenario
::
::  ~zod hosts a private group and invites ~bud as an admin, and
::  records ~bud as invited. ~bud joins the group, and ~zod then
::  drops her invited record. ~bud then invites ~nec as another
::  member. ~nec receives the invitation and joins the group
::  successfully, receiving the group creation fact.
::
++  ph-test-group-join-private-invite
  =/  m  (strand ,~)
  ^-  form:m
  ;<  ~  bind:m  (watch-app /~bud/groups/v1/groups [~bud %groups] /v1/groups)
  ;<  ~  bind:m  (watch-app /~bud/groups/v1/foreigns [~bud %groups] /v1/foreigns)
  ;<  ~  bind:m  (watch-app /~nec/groups/v1/groups [~nec %groups] /v1/groups)
  ;<  ~  bind:m  (watch-app /~nec/groups/v1/foreigns [~nec %groups] /v1/foreigns)
  ::
  ;<  ~  bind:m  (create-test-group ~zod %private (my ~bud^(sy %admin ~) ~))
  ;<  *  bind:m  (wait-for-app-fact /~bud/groups/v1/foreigns [~bud %groups])
  ;<  ~  bind:m  (ex-invited ~zod ~zod ~bud &)
  ;<  ~  bind:m  (join-test-group ~bud ~zod)
  ;<  ~  bind:m  (ex-r-groups-fact-match-tag ~bud ~zod^%my-test-group %create)
  ;<  ~  bind:m  (ex-invited ~zod ~zod ~bud |)
  =/  =a-groups:v8:gv
    [%invite my-test-flag (sy ~nec ~) [~ ~]]
  ;<  ~  bind:m  (poke-app [~bud %groups] group-action-4+a-groups)
  ;<  *  bind:m  (wait-for-app-fact /~nec/groups/v1/foreigns [~nec %groups])
  ;<  ~  bind:m  (join-test-group ~nec ~zod)
  ;<  ~  bind:m  (ex-r-groups-fact-match-tag ~nec ~zod^%my-test-group %create)
  (pure:m ~)
::  +ph-test-group-public-join-prunes-invites: test a join pruning tokenless invites
::
::  scenario
::
::  ~zod hosts a public group and invites ~nec as an admin, and ~nec
::  joins the group. ~zod and ~nec then each invite ~bud, and ~bud
::  receives both invitations. the invitations carry no token, and
::  ~zod holds no personal token for ~bud, so no token deletion can
::  prune them: the pruning can only come from the join on ~zod and
::  from the seat update on ~nec. ~zod and ~nec record ~bud as
::  invited. ~bud then joins without a token, and ~nec receives ~bud's
::  seat with a joined time. ~nec and ~zod then drop their invited
::  records of ~bud. ~bud then receives the group, and keeps no
::  foreign record of it.
::
++  ph-test-group-public-join-prunes-invites
  =/  m  (strand ,~)
  ^-  form:m
  ;<  ~  bind:m  (watch-app /~nec/groups/v1/groups [~nec %groups] /v1/groups)
  ;<  ~  bind:m  (watch-app /~nec/groups/v1/foreigns [~nec %groups] /v1/foreigns)
  ;<  ~  bind:m  (watch-app /~bud/groups/v1/groups [~bud %groups] /v1/groups)
  ;<  ~  bind:m  (watch-app /~bud/groups/v1/foreigns [~bud %groups] /v1/foreigns)
  ::  ~zod hosts a public group and invites ~nec as an admin, then ~nec
  ::  joins the group.
  ::
  ;<  ~  bind:m  (create-test-group ~zod %public (my ~nec^(sy %admin ~) ~))
  ;<  *  bind:m  (wait-for-app-fact /~nec/groups/v1/foreigns [~nec %groups])
  ;<  ~  bind:m  (join-test-group ~nec ~zod)
  ;<  ~  bind:m  (ex-r-groups-fact-match-tag ~nec my-test-flag %create)
  ::  ~zod and ~nec each invite ~bud, and ~bud receives both
  ::  invitations. in a public group the invitation is sent directly,
  ::  with no token request.
  ::
  =/  =a-groups:v8:gv  [%invite my-test-flag (sy ~bud ~) [~ ~]]
  ;<  ~  bind:m  (poke-app [~zod %groups] group-action-4+a-groups)
  ;<  ~  bind:m  (ex-foreign-invite-valid ~bud my-test-flag ~zod &)
  ;<  ~  bind:m  (poke-app [~nec %groups] group-action-4+a-groups)
  ;<  ~  bind:m  (ex-foreign-invite-valid ~bud my-test-flag ~nec &)
  ::  ~bud holds both invitations, neither carrying a token. ~zod and
  ::  ~nec record ~bud as invited, and ~zod holds no personal token for
  ::  her.
  ::
  ;<  foreign=(unit foreign:v10:gv)  bind:m  (scry-test-foreign ~bud ~zod)
  ;<  ~  bind:m  (ex-equal !>(?=(^ foreign)) !>(&))
  ?>  ?=(^ foreign)
  ;<  ~  bind:m
    %+  ex-equal
      !>((turn invites.u.foreign |=(=invite:v8:gv from.invite)))
    !>(`(list ship)`~[~nec ~zod])
  ;<  ~  bind:m
    %+  ex-equal
      !>((turn invites.u.foreign |=(=invite:v8:gv token.invite)))
    !>(`(list (unit token:g))`~[~ ~])
  ;<  ~  bind:m  (ex-invited ~zod ~zod ~bud &)
  ;<  ~  bind:m  (ex-invited ~nec ~zod ~bud &)
  ;<  =group:v11:gv  bind:m  (scry-test-group ~zod ~zod)
  ;<  ~  bind:m  (ex-equal !>((personal-tokens group ~bud)) !>(*(set token:g)))
  ::  ~bud joins the group without a token.
  ::
  =/  =a-foreigns:v8:gv  [%foreign my-test-flag %join ~]
  ;<  ~  bind:m  (poke-app [~bud %groups] group-foreign-2+a-foreigns)
  ::  ~nec receives ~bud's seat with a joined time. ~nec prunes her
  ::  invite in the event that takes the seat update, and ~zod pruned
  ::  hers before emitting it, so both are checked once it arrives.
  ::
  ;<  *  bind:m
    %^  wait-for-r-group  ~nec  my-test-flag
    |=  r=r-group:v10:gv
    ?.  ?=(%seat -.r)  |
    ?.  =((sy ~bud ~) ships.r)  |
    ?.  ?=(%add -.r-seat.r)  |
    !=(*@da joined.seat.r-seat.r)
  ;<  ~  bind:m  (ex-invited ~nec ~zod ~bud |)
  ;<  ~  bind:m  (ex-invited ~zod ~zod ~bud |)
  ::  ~bud receives the group, and keeps no foreign record of it.
  ::
  ;<  ~  bind:m  (ex-r-groups-fact-match-tag ~bud my-test-flag %create)
  ;<  foreign=(unit foreign:v10:gv)  bind:m  (scry-test-foreign ~bud ~zod)
  ;<  ~  bind:m  (ex-equal !>(foreign) !>(`(unit foreign:v10:gv)`~))
  (pure:m ~)
::  +ph-test-group-join-private-two-invites: test a join spending all invites
::
::  scenario
::
::  ~zod hosts a private group and invites ~nec as an admin, and ~nec
::  joins the group. ~zod and ~nec then each invite ~bud, and ~bud
::  receives both invitations. ~zod and ~nec record ~bud as invited,
::  and ~zod holds a personal token for ~bud from each invitation.
::  ~bud then joins with ~zod's token, and ~zod spends both tokens.
::  ~nec receives ~bud's seat and then the deletion of both tokens,
::  and the seat update is verified to precede the token deletions,
::  since that keeps ~nec from revoking the invite of a joined ship.
::  ~zod and ~nec then drop their invited records of ~bud, and
::  neither holds a personal token for her.
::
++  ph-test-group-join-private-two-invites
  =/  m  (strand ,~)
  ^-  form:m
  ;<  ~  bind:m  (watch-app /~nec/groups/v1/groups [~nec %groups] /v1/groups)
  ;<  ~  bind:m  (watch-app /~nec/groups/v1/foreigns [~nec %groups] /v1/foreigns)
  ;<  ~  bind:m  (watch-app /~bud/groups/v1/groups [~bud %groups] /v1/groups)
  ;<  ~  bind:m  (watch-app /~bud/groups/v1/foreigns [~bud %groups] /v1/foreigns)
  ::  ~zod hosts a private group and invites ~nec as an admin, then
  ::  ~nec joins the group.
  ::
  ;<  ~  bind:m  (create-test-group ~zod %private (my ~nec^(sy %admin ~) ~))
  ;<  *  bind:m  (wait-for-app-fact /~nec/groups/v1/foreigns [~nec %groups])
  ;<  ~  bind:m  (join-test-group ~nec ~zod)
  ;<  ~  bind:m  (ex-r-groups-fact-match-tag ~nec my-test-flag %create)
  ::  ~zod and ~nec each invite ~bud, and ~bud receives both invitations.
  ::
  =/  =a-groups:v8:gv  [%invite my-test-flag (sy ~bud ~) [~ ~]]
  ;<  ~  bind:m  (poke-app [~zod %groups] group-action-4+a-groups)
  ;<  ~  bind:m  (ex-foreign-invite-valid ~bud my-test-flag ~zod &)
  ;<  ~  bind:m  (poke-app [~nec %groups] group-action-4+a-groups)
  ;<  ~  bind:m  (ex-foreign-invite-valid ~bud my-test-flag ~nec &)
  ;<  =bowl:strand  bind:m  get-bowl
  =/  aqua-pax
    /gx/~bud/groups/(scot %da now.bowl)/v2/foreigns/~zod/my-test-group/noun
  ;<  foreign=(unit foreign:v10:gv)  bind:m
    (scry-aqua (unit foreign:v10:gv) ~bud aqua-pax)
  ;<  ~  bind:m  (ex-equal !>(?=(^ foreign)) !>(&))
  ?>  ?=(^ foreign)
  ;<  ~  bind:m
    %+  ex-equal
      !>((turn invites.u.foreign |=(=invite:v8:gv from.invite)))
    !>(`(list ship)`~[~nec ~zod])
  ::  ~zod and ~nec record ~bud as invited, and ~zod holds exactly
  ::  the personal tokens of ~bud's two invitations.
  ::
  ;<  ~  bind:m  (ex-invited ~zod ~zod ~bud &)
  ;<  ~  bind:m  (ex-invited ~nec ~zod ~bud &)
  =/  bud-tokens=(set token:g)
    %-  ~(gas in *(set token:g))
    (murn invites.u.foreign |=(=invite:v8:gv token.invite))
  ;<  =group:v11:gv  bind:m  (scry-test-group ~zod ~zod)
  ;<  ~  bind:m  (ex-equal !>((personal-tokens group ~bud)) !>(bud-tokens))
  ::  ~bud joins the group with ~zod's token.
  ::
  =/  host-invites=(list invite:v8:gv)
    (skim invites.u.foreign |=(=invite:v8:gv =(~zod from.invite)))
  ?>  ?=([* ~] host-invites)
  =/  =a-foreigns:v8:gv
    [%foreign my-test-flag %join token.i.host-invites]
  ;<  ~  bind:m  (poke-app [~bud %groups] group-foreign-2+a-foreigns)
  ::  ~nec receives ~bud's seat, then exactly the deletions of both of
  ::  ~bud's tokens. responses to ~nec predating the join are skipped,
  ::  but a deletion of ~bud's token ends the skip and fails the seat
  ::  check. ~zod sends these before serving ~bud the group, so they
  ::  are awaited before ~bud's creation fact.
  ::
  ;<  r=r-group:v10:gv  bind:m
    %^  wait-for-r-group  ~nec  my-test-flag
    |=  r=r-group:v10:gv
    ?:  ?=(%seat -.r)  &
    ?.  ?=(%entry -.r)  |
    ?.  ?=(%token -.r-entry.r)  |
    ?.  ?=(%del -.r-token.r-entry.r)  |
    (~(has in bud-tokens) token.r-token.r-entry.r)
  ;<  ~  bind:m  (ex-equal !>(`@tas`-.r) !>(%seat))
  ?>  ?=(%seat -.r)
  ;<  ~  bind:m  (ex-equal !>(ships.r) !>((sy ~bud ~)))
  ;<  ~  bind:m  (ex-equal !>(`@tas`-.r-seat.r) !>(%add))
  ?>  ?=(%add -.r-seat.r)
  ;<  ~  bind:m  (ex-not-equal !>(joined.seat.r-seat.r) !>(*@da))
  ;<  tok-1=token:g  bind:m  (ex-r-groups-token-del ~nec my-test-flag)
  ;<  tok-2=token:g  bind:m  (ex-r-groups-token-del ~nec my-test-flag)
  ;<  ~  bind:m  (ex-equal !>((~(has in bud-tokens) tok-1)) !>(&))
  ;<  ~  bind:m  (ex-equal !>((~(has in bud-tokens) tok-2)) !>(&))
  ;<  ~  bind:m  (ex-not-equal !>(tok-1) !>(tok-2))
  ;<  ~  bind:m  (ex-r-groups-fact-match-tag ~bud my-test-flag %create)
  ::  ~zod and ~nec drop their invited records of ~bud, and neither
  ::  holds a personal token for her.
  ::
  ;<  ~  bind:m  (ex-invited ~zod ~zod ~bud |)
  ;<  ~  bind:m  (ex-invited ~nec ~zod ~bud |)
  ;<  =group:v11:gv  bind:m  (scry-test-group ~zod ~zod)
  ;<  ~  bind:m  (ex-equal !>((personal-tokens group ~bud)) !>(*(set token:g)))
  ;<  =group:v11:gv  bind:m  (scry-test-group ~nec ~zod)
  ;<  ~  bind:m  (ex-equal !>((personal-tokens group ~bud)) !>(*(set token:g)))
  (pure:m ~)
::  +ph-test-group-join-seated-at-creation: test a tokenless join of a ship seated at creation
::
::  scenario
::
::  ~zod hosts a private group with ~nec as an admin and ~bud as a
::  member, and invites both. ~nec joins the group, then invites ~bud,
::  and ~bud receives both invitations. ~zod and ~nec record ~bud as
::  invited, and ~zod holds a personal token for ~bud from each
::  invitation. ~bud then joins without a token, admitted by her seat,
::  and ~zod spends both tokens. ~nec receives ~bud's seat and then
::  the deletion of both tokens, and the seat update is verified to
::  precede the token deletions, since that keeps ~nec from revoking
::  the invite of a joined ship. ~zod and ~nec then drop their invited
::  records of ~bud, and neither holds a personal token for her.
::
++  ph-test-group-join-seated-at-creation
  =/  m  (strand ,~)
  ^-  form:m
  ;<  ~  bind:m  (watch-app /~nec/groups/v1/groups [~nec %groups] /v1/groups)
  ;<  ~  bind:m  (watch-app /~nec/groups/v1/foreigns [~nec %groups] /v1/foreigns)
  ;<  ~  bind:m  (watch-app /~bud/groups/v1/groups [~bud %groups] /v1/groups)
  ;<  ~  bind:m  (watch-app /~bud/groups/v1/foreigns [~bud %groups] /v1/foreigns)
  ::  ~zod hosts a private group with ~nec as an admin and ~bud as a
  ::  member, and ~bud receives ~zod's invitation. ~nec then joins the
  ::  group.
  ::
  ;<  ~  bind:m
    (create-test-group ~zod %private (my ~nec^(sy %admin ~) ~bud^~ ~))
  ;<  ~  bind:m  (ex-foreign-invite-valid ~bud my-test-flag ~zod &)
  ;<  *  bind:m  (wait-for-app-fact /~nec/groups/v1/foreigns [~nec %groups])
  ;<  ~  bind:m  (join-test-group ~nec ~zod)
  ;<  ~  bind:m  (ex-r-groups-fact-match-tag ~nec my-test-flag %create)
  ::  ~nec invites ~bud, and ~bud holds both invitations.
  ::
  =/  =a-groups:v8:gv  [%invite my-test-flag (sy ~bud ~) [~ ~]]
  ;<  ~  bind:m  (poke-app [~nec %groups] group-action-4+a-groups)
  ;<  ~  bind:m  (ex-foreign-invite-valid ~bud my-test-flag ~nec &)
  ;<  =bowl:strand  bind:m  get-bowl
  =/  aqua-pax
    /gx/~bud/groups/(scot %da now.bowl)/v2/foreigns/~zod/my-test-group/noun
  ;<  foreign=(unit foreign:v10:gv)  bind:m
    (scry-aqua (unit foreign:v10:gv) ~bud aqua-pax)
  ;<  ~  bind:m  (ex-equal !>(?=(^ foreign)) !>(&))
  ?>  ?=(^ foreign)
  ;<  ~  bind:m
    %+  ex-equal
      !>((turn invites.u.foreign |=(=invite:v8:gv from.invite)))
    !>(`(list ship)`~[~nec ~zod])
  ::  ~zod and ~nec record ~bud as invited, and ~zod holds exactly
  ::  the personal tokens of ~bud's two invitations.
  ::
  ;<  ~  bind:m  (ex-invited ~zod ~zod ~bud &)
  ;<  ~  bind:m  (ex-invited ~nec ~zod ~bud &)
  =/  bud-tokens=(set token:g)
    %-  ~(gas in *(set token:g))
    (murn invites.u.foreign |=(=invite:v8:gv token.invite))
  ;<  =group:v11:gv  bind:m  (scry-test-group ~zod ~zod)
  ;<  ~  bind:m  (ex-equal !>((personal-tokens group ~bud)) !>(bud-tokens))
  ::  ~bud joins the group without a token.
  ::
  =/  =a-foreigns:v8:gv  [%foreign my-test-flag %join ~]
  ;<  ~  bind:m  (poke-app [~bud %groups] group-foreign-2+a-foreigns)
  ::  ~nec receives ~bud's seat, then exactly the deletions of both of
  ::  ~bud's tokens. responses to ~nec predating the join are skipped,
  ::  but a deletion of ~bud's token ends the skip and fails the seat
  ::  check. ~zod sends these before serving ~bud the group, so they
  ::  are awaited before ~bud's creation fact.
  ::
  ;<  r=r-group:v10:gv  bind:m
    %^  wait-for-r-group  ~nec  my-test-flag
    |=  r=r-group:v10:gv
    ?:  ?=(%seat -.r)  &
    ?.  ?=(%entry -.r)  |
    ?.  ?=(%token -.r-entry.r)  |
    ?.  ?=(%del -.r-token.r-entry.r)  |
    (~(has in bud-tokens) token.r-token.r-entry.r)
  ;<  ~  bind:m  (ex-equal !>(`@tas`-.r) !>(%seat))
  ?>  ?=(%seat -.r)
  ;<  ~  bind:m  (ex-equal !>(ships.r) !>((sy ~bud ~)))
  ;<  ~  bind:m  (ex-equal !>(`@tas`-.r-seat.r) !>(%add))
  ?>  ?=(%add -.r-seat.r)
  ;<  ~  bind:m  (ex-not-equal !>(joined.seat.r-seat.r) !>(*@da))
  ;<  tok-1=token:g  bind:m  (ex-r-groups-token-del ~nec my-test-flag)
  ;<  tok-2=token:g  bind:m  (ex-r-groups-token-del ~nec my-test-flag)
  ;<  ~  bind:m  (ex-equal !>((~(has in bud-tokens) tok-1)) !>(&))
  ;<  ~  bind:m  (ex-equal !>((~(has in bud-tokens) tok-2)) !>(&))
  ;<  ~  bind:m  (ex-not-equal !>(tok-1) !>(tok-2))
  ;<  ~  bind:m  (ex-r-groups-fact-match-tag ~bud my-test-flag %create)
  ::  ~zod and ~nec drop their invited records of ~bud, and neither
  ::  holds a personal token for her.
  ::
  ;<  ~  bind:m  (ex-invited ~zod ~zod ~bud |)
  ;<  ~  bind:m  (ex-invited ~nec ~zod ~bud |)
  ;<  =group:v11:gv  bind:m  (scry-test-group ~zod ~zod)
  ;<  ~  bind:m  (ex-equal !>((personal-tokens group ~bud)) !>(*(set token:g)))
  ;<  =group:v11:gv  bind:m  (scry-test-group ~nec ~zod)
  ;<  ~  bind:m  (ex-equal !>((personal-tokens group ~bud)) !>(*(set token:g)))
  (pure:m ~)
::  +ph-test-group-join-seated-by-admin: test a tokenless join of a ship seated by an admin
::
::  scenario
::
::  ~zod hosts a private group and invites ~nec as an admin, and ~nec
::  joins the group. ~nec then seats ~bud, and ~zod invites ~bud for
::  her new seat. ~nec then also invites ~bud, and ~bud receives both
::  invitations. ~zod and ~nec record ~bud as invited, and ~zod holds
::  a personal token for ~bud from each invitation. ~bud then joins
::  without a token, admitted by her seat, and ~zod spends both
::  tokens. ~nec receives ~bud's joined seat and then the deletion of
::  both tokens, and the seat update is verified to precede the token
::  deletions, since that keeps ~nec from revoking the invite of a
::  joined ship. ~zod and ~nec then drop their invited records of
::  ~bud, and neither holds a personal token for her.
::
++  ph-test-group-join-seated-by-admin
  =/  m  (strand ,~)
  ^-  form:m
  ;<  ~  bind:m  (watch-app /~nec/groups/v1/groups [~nec %groups] /v1/groups)
  ;<  ~  bind:m  (watch-app /~nec/groups/v1/foreigns [~nec %groups] /v1/foreigns)
  ;<  ~  bind:m  (watch-app /~bud/groups/v1/groups [~bud %groups] /v1/groups)
  ;<  ~  bind:m  (watch-app /~bud/groups/v1/foreigns [~bud %groups] /v1/foreigns)
  ::  ~zod hosts a private group and invites ~nec as an admin, then
  ::  ~nec joins the group.
  ::
  ;<  ~  bind:m  (create-test-group ~zod %private (my ~nec^(sy %admin ~) ~))
  ;<  *  bind:m  (wait-for-app-fact /~nec/groups/v1/foreigns [~nec %groups])
  ;<  ~  bind:m  (join-test-group ~nec ~zod)
  ;<  ~  bind:m  (ex-r-groups-fact-match-tag ~nec my-test-flag %create)
  ::  ~nec seats ~bud, and ~bud receives ~zod's invitation for her
  ::  seat. ~nec then invites ~bud, and ~bud holds both invitations.
  ::
  =/  =a-groups:v8:gv  [%group my-test-flag [%seat (sy ~bud ~) [%add ~]]]
  ;<  ~  bind:m  (poke-app [~nec %groups] group-action-4+a-groups)
  ;<  ~  bind:m  (ex-foreign-invite-valid ~bud my-test-flag ~zod &)
  =/  =a-groups:v8:gv  [%invite my-test-flag (sy ~bud ~) [~ ~]]
  ;<  ~  bind:m  (poke-app [~nec %groups] group-action-4+a-groups)
  ;<  ~  bind:m  (ex-foreign-invite-valid ~bud my-test-flag ~nec &)
  ;<  =bowl:strand  bind:m  get-bowl
  =/  aqua-pax
    /gx/~bud/groups/(scot %da now.bowl)/v2/foreigns/~zod/my-test-group/noun
  ;<  foreign=(unit foreign:v10:gv)  bind:m
    (scry-aqua (unit foreign:v10:gv) ~bud aqua-pax)
  ;<  ~  bind:m  (ex-equal !>(?=(^ foreign)) !>(&))
  ?>  ?=(^ foreign)
  ;<  ~  bind:m
    %+  ex-equal
      !>((turn invites.u.foreign |=(=invite:v8:gv from.invite)))
    !>(`(list ship)`~[~nec ~zod])
  ::  ~zod and ~nec record ~bud as invited, and ~zod holds exactly
  ::  the personal tokens of ~bud's two invitations.
  ::
  ;<  ~  bind:m  (ex-invited ~zod ~zod ~bud &)
  ;<  ~  bind:m  (ex-invited ~nec ~zod ~bud &)
  =/  bud-tokens=(set token:g)
    %-  ~(gas in *(set token:g))
    (murn invites.u.foreign |=(=invite:v8:gv token.invite))
  ;<  =group:v11:gv  bind:m  (scry-test-group ~zod ~zod)
  ;<  ~  bind:m  (ex-equal !>((personal-tokens group ~bud)) !>(bud-tokens))
  ::  ~bud joins the group without a token.
  ::
  =/  =a-foreigns:v8:gv  [%foreign my-test-flag %join ~]
  ;<  ~  bind:m  (poke-app [~bud %groups] group-foreign-2+a-foreigns)
  ::  ~nec receives ~bud's joined seat, then exactly the deletions of
  ::  both of ~bud's tokens. responses to ~nec predating the join are
  ::  skipped, but a deletion of ~bud's token ends the skip and fails
  ::  the seat check. ~nec's seating of ~bud already carried a seat
  ::  addition with the default joined time, so a seat addition is
  ::  only accepted once it carries a joined time. ~zod sends these
  ::  before serving ~bud the group, so they are awaited before ~bud's
  ::  creation fact.
  ::
  ;<  r=r-group:v10:gv  bind:m
    %^  wait-for-r-group  ~nec  my-test-flag
    |=  r=r-group:v10:gv
    ?:  ?=(%seat -.r)
      ?.  ?=(%add -.r-seat.r)  &
      !=(*@da joined.seat.r-seat.r)
    ?.  ?=(%entry -.r)  |
    ?.  ?=(%token -.r-entry.r)  |
    ?.  ?=(%del -.r-token.r-entry.r)  |
    (~(has in bud-tokens) token.r-token.r-entry.r)
  ;<  ~  bind:m  (ex-equal !>(`@tas`-.r) !>(%seat))
  ?>  ?=(%seat -.r)
  ;<  ~  bind:m  (ex-equal !>(ships.r) !>((sy ~bud ~)))
  ;<  ~  bind:m  (ex-equal !>(`@tas`-.r-seat.r) !>(%add))
  ?>  ?=(%add -.r-seat.r)
  ;<  ~  bind:m  (ex-not-equal !>(joined.seat.r-seat.r) !>(*@da))
  ;<  tok-1=token:g  bind:m  (ex-r-groups-token-del ~nec my-test-flag)
  ;<  tok-2=token:g  bind:m  (ex-r-groups-token-del ~nec my-test-flag)
  ;<  ~  bind:m  (ex-equal !>((~(has in bud-tokens) tok-1)) !>(&))
  ;<  ~  bind:m  (ex-equal !>((~(has in bud-tokens) tok-2)) !>(&))
  ;<  ~  bind:m  (ex-not-equal !>(tok-1) !>(tok-2))
  ;<  ~  bind:m  (ex-r-groups-fact-match-tag ~bud my-test-flag %create)
  ::  ~zod and ~nec drop their invited records of ~bud, and neither
  ::  holds a personal token for her.
  ::
  ;<  ~  bind:m  (ex-invited ~zod ~zod ~bud |)
  ;<  ~  bind:m  (ex-invited ~nec ~zod ~bud |)
  ;<  =group:v11:gv  bind:m  (scry-test-group ~zod ~zod)
  ;<  ~  bind:m  (ex-equal !>((personal-tokens group ~bud)) !>(*(set token:g)))
  ;<  =group:v11:gv  bind:m  (scry-test-group ~nec ~zod)
  ;<  ~  bind:m  (ex-equal !>((personal-tokens group ~bud)) !>(*(set token:g)))
  (pure:m ~)
::  +ph-test-group-rejoin: test joins of a ship holding the group
::
::  scenario
::
::  ~zod hosts a private group with ~nec as an admin, and ~nec joins
::  the group. ~zod then invites ~bud, and ~bud joins the group with
::  ~zod's token. ~bud then joins again without a token, and her join
::  is vacuous: ~zod keeps her joined time and holds no personal token
::  for her. ~bud keeps no foreign record of the group.
::  ~nec then invites ~bud, and ~bud drops the invitation of a group
::  she holds, while ~nec records her as invited and ~zod holds a
::  personal token for her. ~bud then joins again without a token,
::  and ~zod spends the token. ~nec receives ~bud's seat with a new
::  joined time and then the deletion of the token. ~nec then drops
::  her invited record of ~bud, neither ~zod nor ~nec holds a personal
::  token for her, and ~bud keeps no foreign record of the group.
::
++  ph-test-group-rejoin
  =/  m  (strand ,~)
  ^-  form:m
  ;<  ~  bind:m  (watch-app /~nec/groups/v1/groups [~nec %groups] /v1/groups)
  ;<  ~  bind:m  (watch-app /~nec/groups/v1/foreigns [~nec %groups] /v1/foreigns)
  ;<  ~  bind:m  (watch-app /~bud/groups/v1/groups [~bud %groups] /v1/groups)
  ;<  ~  bind:m  (watch-app /~bud/groups/v1/foreigns [~bud %groups] /v1/foreigns)
  ::  ~zod hosts a private group with ~nec as an admin, then ~nec joins
  ::  the group.
  ::
  ;<  ~  bind:m  (create-test-group ~zod %private (my ~nec^(sy %admin ~) ~))
  ;<  *  bind:m  (wait-for-app-fact /~nec/groups/v1/foreigns [~nec %groups])
  ;<  ~  bind:m  (join-test-group ~nec ~zod)
  ;<  ~  bind:m  (ex-r-groups-fact-match-tag ~nec my-test-flag %create)
  ::  ~zod invites ~bud, and ~bud joins the group with ~zod's token.
  ::  ~nec receives ~bud's seat and then the deletion of the token.
  ::  ~zod sends these before serving ~bud the group, so they are
  ::  awaited before ~bud's creation fact.
  ::
  =/  =a-groups:v8:gv  [%invite my-test-flag (sy ~bud ~) [~ ~]]
  ;<  ~  bind:m  (poke-app [~zod %groups] group-action-4+a-groups)
  ;<  ~  bind:m  (ex-foreign-invite-valid ~bud my-test-flag ~zod &)
  ;<  ~  bind:m  (join-test-group ~bud ~zod)
  ;<  r=r-group:v10:gv  bind:m
    %^  wait-for-r-group  ~nec  my-test-flag
    |=  r=r-group:v10:gv
    ?:  ?=(%seat -.r)  &
    ?.  ?=(%entry -.r)  |
    ?.  ?=(%token -.r-entry.r)  |
    ?=(%del -.r-token.r-entry.r)
  ;<  ~  bind:m  (ex-equal !>(`@tas`-.r) !>(%seat))
  ?>  ?=(%seat -.r)
  ;<  ~  bind:m  (ex-equal !>(ships.r) !>((sy ~bud ~)))
  ;<  *  bind:m  (ex-r-groups-token-del ~nec my-test-flag)
  ;<  ~  bind:m  (ex-r-groups-fact-match-tag ~bud my-test-flag %create)
  ::  ~bud joins again without a token. her client pokes ~zod all the
  ::  same, and ~zod acknowledges the join without an update. the
  ::  acknowledgement is awaited on ~bud's foreigns: her client
  ::  updates the foreign record when it starts the join, and again
  ::  when it takes the acknowledgement. updates of the earlier join
  ::  are skipped up to the start of this one.
  ::
  ;<  =group:v11:gv  bind:m  (scry-test-group ~zod ~zod)
  =/  seat=(unit seat:g)  (~(get by seats.group) ~bud)
  ;<  ~  bind:m  (ex-equal !>(?=(^ seat)) !>(&))
  ?>  ?=(^ seat)
  =/  joined=@da  joined.u.seat
  =/  =a-foreigns:v8:gv  [%foreign my-test-flag %join ~]
  ;<  ~  bind:m  (poke-app [~bud %groups] group-foreign-2+a-foreigns)
  ;<  *  bind:m
    %^  wait-for-foreign  ~bud  my-test-flag
    |=(far=foreign:v8:gv =([~ %join] progress.far))
  ;<  *  bind:m
    (wait-for-foreign ~bud my-test-flag |=(foreign:v8:gv &))
  ::  ~zod keeps ~bud's joined time and holds no personal token for
  ::  her, and ~bud keeps no foreign record of the group.
  ::
  ;<  =group:v11:gv  bind:m  (scry-test-group ~zod ~zod)
  =/  seat=(unit seat:g)  (~(get by seats.group) ~bud)
  ;<  ~  bind:m  (ex-equal !>(?=(^ seat)) !>(&))
  ?>  ?=(^ seat)
  ;<  ~  bind:m  (ex-equal !>(joined.u.seat) !>(joined))
  ;<  ~  bind:m  (ex-equal !>((personal-tokens group ~bud)) !>(*(set token:g)))
  ;<  foreign=(unit foreign:v10:gv)  bind:m  (scry-test-foreign ~bud ~zod)
  ;<  ~  bind:m  (ex-equal !>(foreign) !>(`(unit foreign:v10:gv)`~))
  ::  ~nec invites ~bud, and ~bud drops the invitation of a group she
  ::  holds. ~nec requests a personal token for ~bud from ~zod, and
  ::  sends the invitation once she receives it. its addition, which
  ::  ~nec receives as an admin, is awaited instead.
  ::
  =/  =a-groups:v8:gv  [%invite my-test-flag (sy ~bud ~) [~ ~]]
  ;<  ~  bind:m  (poke-app [~nec %groups] group-action-4+a-groups)
  ;<  r=r-group:v10:gv  bind:m
    %^  wait-for-r-group  ~nec  my-test-flag
    |=  r=r-group:v10:gv
    ?.  ?=(%entry -.r)  |
    ?.  ?=(%token -.r-entry.r)  |
    ?.  ?=(%add -.r-token.r-entry.r)  |
    =([%personal ~bud] scheme.meta.r-token.r-entry.r)
  ?>  ?=(%entry -.r)
  ?>  ?=(%token -.r-entry.r)
  ?>  ?=(%add -.r-token.r-entry.r)
  =/  tok=token:g  token.r-token.r-entry.r
  ::  ~zod holds the personal token for ~bud. ~nec records ~bud as
  ::  invited only once she takes the token on her own watch, which
  ::  the update does not order, so her record is not checked here.
  ::
  ;<  =group:v11:gv  bind:m  (scry-test-group ~zod ~zod)
  ;<  ~  bind:m  (ex-equal !>((personal-tokens group ~bud)) !>((sy tok ~)))
  ::  ~bud joins again without a token. ~nec receives ~bud's seat with
  ::  a new joined time, then exactly the deletion of the token.
  ::
  =/  =a-foreigns:v8:gv  [%foreign my-test-flag %join ~]
  ;<  ~  bind:m  (poke-app [~bud %groups] group-foreign-2+a-foreigns)
  ;<  r=r-group:v10:gv  bind:m
    %^  wait-for-r-group  ~nec  my-test-flag
    |=  r=r-group:v10:gv
    ?:  ?=(%seat -.r)  &
    ?.  ?=(%entry -.r)  |
    ?.  ?=(%token -.r-entry.r)  |
    ?.  ?=(%del -.r-token.r-entry.r)  |
    =(tok token.r-token.r-entry.r)
  ;<  ~  bind:m  (ex-equal !>(`@tas`-.r) !>(%seat))
  ?>  ?=(%seat -.r)
  ;<  ~  bind:m  (ex-equal !>(ships.r) !>((sy ~bud ~)))
  ;<  ~  bind:m  (ex-equal !>(`@tas`-.r-seat.r) !>(%add))
  ?>  ?=(%add -.r-seat.r)
  ;<  ~  bind:m  (ex-not-equal !>(joined.seat.r-seat.r) !>(joined))
  ;<  del=token:g  bind:m  (ex-r-groups-token-del ~nec my-test-flag)
  ;<  ~  bind:m  (ex-equal !>(del) !>(tok))
  ::  ~nec drops her invited record of ~bud, neither ~zod nor ~nec
  ::  holds a personal token for her, and ~bud keeps no foreign record
  ::  of the group.
  ::
  ;<  ~  bind:m  (ex-invited ~nec ~zod ~bud |)
  ;<  =group:v11:gv  bind:m  (scry-test-group ~zod ~zod)
  ;<  ~  bind:m  (ex-equal !>((personal-tokens group ~bud)) !>(*(set token:g)))
  ;<  =group:v11:gv  bind:m  (scry-test-group ~nec ~zod)
  ;<  ~  bind:m  (ex-equal !>((personal-tokens group ~bud)) !>(*(set token:g)))
  ;<  foreign=(unit foreign:v10:gv)  bind:m  (scry-test-foreign ~bud ~zod)
  ;<  ~  bind:m  (ex-equal !>(foreign) !>(`(unit foreign:v10:gv)`~))
  (pure:m ~)
::  +ph-test-group-private-invite-revoke-delete: test private invite revocation on token deletion
::
::  scenario
::
::  ~zod hosts a private group with ~nec as an admin, and ~nec joins
::  the group. ~zod then invites ~bud, and ~bud receives the invitation.
::  ~zod records ~bud as invited and holds a personal token for her.
::  ~zod then deletes the token, and ~bud receives a revoked invitation.
::  ~zod drops the invited record of ~bud and holds no personal token
::  for her. ~nec then invites ~wes, and receives the addition of a
::  personal token for ~wes. by then ~nec holds no personal token for
::  ~bud. ~bud then attempts to join with the deleted token, and ~zod
::  denies her. ~bud then ends the join with an error, and does not
::  hold the group.
::
++  ph-test-group-private-invite-revoke-delete
  =/  m  (strand ,~)
  ^-  form:m
  ;<  ~  bind:m  (watch-app /~nec/groups/v1/groups [~nec %groups] /v1/groups)
  ;<  ~  bind:m  (watch-app /~nec/groups/v1/foreigns [~nec %groups] /v1/foreigns)
  ;<  ~  bind:m  (watch-app /~bud/groups/v1/foreigns [~bud %groups] /v1/foreigns)
  ::  ~zod hosts a private group with ~nec as an admin, then ~nec joins
  ::  the group.
  ::
  ;<  ~  bind:m  (create-test-group ~zod %private (my ~nec^(sy %admin ~) ~))
  ;<  *  bind:m  (wait-for-app-fact /~nec/groups/v1/foreigns [~nec %groups])
  ;<  ~  bind:m  (join-test-group ~nec ~zod)
  ;<  ~  bind:m  (ex-r-groups-fact-match-tag ~nec my-test-flag %create)
  ::  ~zod invites ~bud, and ~bud receives the invitation. ~zod mints
  ::  the token and sends the invitation in one event, so the token
  ::  addition on ~nec's wire is not awaited: it would race ~bud's
  ::  invitation, and the harness drops facts on other wires.
  ::
  =/  =a-groups:v8:gv  [%invite my-test-flag (sy ~bud ~) [~ ~]]
  ;<  ~  bind:m  (poke-app [~zod %groups] group-action-4+a-groups)
  ;<  ~  bind:m  (ex-foreign-invite-valid ~bud my-test-flag ~zod &)
  ::  ~zod records ~bud as invited and holds a personal token for her.
  ::
  ;<  ~  bind:m  (ex-invited ~zod ~zod ~bud &)
  ;<  =group:v11:gv  bind:m  (scry-test-group ~zod ~zod)
  =/  bud-tokens=(set token:g)  (personal-tokens group ~bud)
  ;<  ~  bind:m  (ex-equal !>(~(wyt in bud-tokens)) !>(1))
  ?>  ?=([* ~ ~] bud-tokens)
  =/  tok=token:g  n.bud-tokens
  ::  ~zod deletes the token, and ~bud receives a revoked invitation.
  ::  ~zod drops the invited record of ~bud and holds no personal
  ::  token for her.
  ::
  =/  =a-groups:v8:gv  [%group my-test-flag [%entry [%token [%del tok]]]]
  ;<  ~  bind:m  (poke-app [~zod %groups] group-action-4+a-groups)
  ;<  ~  bind:m  (ex-foreign-invite-valid ~bud my-test-flag ~zod |)
  ;<  ~  bind:m  (ex-invited ~zod ~zod ~bud |)
  ;<  =group:v11:gv  bind:m  (scry-test-group ~zod ~zod)
  ;<  ~  bind:m  (ex-equal !>((personal-tokens group ~bud)) !>(*(set token:g)))
  ::  ~nec invites ~wes, and receives the addition of a personal token
  ::  for ~wes. ~zod sends the token deletion to ~nec in the same event
  ::  as the revocation to ~bud, so it is not awaited directly. ~nec's
  ::  subscription delivers the deletion before the later addition,
  ::  so the addition is the sync point. ~nec then holds no personal
  ::  token for ~bud.
  ::
  =/  =a-groups:v8:gv  [%invite my-test-flag (sy ~wes ~) [~ ~]]
  ;<  ~  bind:m  (poke-app [~nec %groups] group-action-4+a-groups)
  ;<  *  bind:m  (wait-for-token-add ~nec my-test-flag ~wes)
  ;<  =group:v11:gv  bind:m  (scry-test-group ~nec ~zod)
  ;<  ~  bind:m  (ex-equal !>((personal-tokens group ~bud)) !>(*(set token:g)))
  ::  ~bud attempts to join with the deleted token, and ~zod denies her.
  ::  ~bud then ends the join with an error, and does not hold the
  ::  group.
  ::
  =/  =a-foreigns:v8:gv  [%foreign my-test-flag %join `tok]
  ;<  ~  bind:m  (poke-app [~bud %groups] group-foreign-2+a-foreigns)
  ;<  *  bind:m
    %^  wait-for-foreign  ~bud  my-test-flag
    |=(far=foreign:v8:gv =([~ %error] progress.far))
  ;<  foreign=(unit foreign:v10:gv)  bind:m  (scry-test-foreign ~bud ~zod)
  ;<  ~  bind:m  (ex-equal !>(?=(^ foreign)) !>(&))
  ?>  ?=(^ foreign)
  ;<  ~  bind:m
    (ex-equal !>(progress.u.foreign) !>(`(unit progress:v10:gv)`[~ %error]))
  ;<  =bowl:strand  bind:m  get-bowl
  =/  aqua-pax
    /gx/~bud/groups/(scot %da now.bowl)/v3/groups/~zod/my-test-group/noun
  ;<  group=(unit group:v11:gv)  bind:m
    (scry-aqua (unit group:v11:gv) ~bud aqua-pax)
  ;<  ~  bind:m  (ex-equal !>(?=(~ group)) !>(&))
  (pure:m ~)
::  +ph-test-group-invite-token-not-owner: test an invite carrying another ship's personal token
::
::  scenario
::
::  ~zod hosts a private group with ~nec as an admin, and ~nec joins
::  the group. ~nec then invites ~bud, and receives the addition of
::  ~bud's personal token, and ~bud then receives the invitation. ~nec
::  then invites ~wes with ~bud's personal token, and her client
::  rejects the invitation. ~nec records no invite of ~wes and keeps
::  her invite of ~bud. ~nec then invites ~wes without a token, and receives the addition
::  of a personal token for ~wes. ~wes then receives this invitation
::  as her first, carrying her own token, and ~nec records her as
::  invited. ~bud still holds ~nec's valid invitation with her token.
::
++  ph-test-group-invite-token-not-owner
  =/  m  (strand ,~)
  ^-  form:m
  ;<  ~  bind:m  (watch-app /~nec/groups/v1/groups [~nec %groups] /v1/groups)
  ;<  ~  bind:m  (watch-app /~nec/groups/v1/foreigns [~nec %groups] /v1/foreigns)
  ;<  ~  bind:m  (watch-app /~bud/groups/v1/groups [~bud %groups] /v1/groups)
  ;<  ~  bind:m  (watch-app /~bud/groups/v1/foreigns [~bud %groups] /v1/foreigns)
  ;<  ~  bind:m  (watch-app /~wes/groups/v1/groups [~wes %groups] /v1/groups)
  ;<  ~  bind:m  (watch-app /~wes/groups/v1/foreigns [~wes %groups] /v1/foreigns)
  ::  ~zod hosts a private group with ~nec as an admin, then ~nec joins
  ::  the group.
  ::
  ;<  ~  bind:m  (create-test-group ~zod %private (my ~nec^(sy %admin ~) ~))
  ;<  *  bind:m  (wait-for-app-fact /~nec/groups/v1/foreigns [~nec %groups])
  ;<  ~  bind:m  (join-test-group ~nec ~zod)
  ;<  ~  bind:m  (ex-r-groups-fact-match-tag ~nec my-test-flag %create)
  ::  ~nec invites ~bud. the token addition on ~nec's updates and the
  ::  token on her watch leave ~zod in one event, so the addition is
  ::  awaited first. this is emission order under aqua, not causal
  ::  order, and a reversal would time out rather than pass.
  ::
  =/  =a-groups:v8:gv  [%invite my-test-flag (sy ~bud ~) [~ ~]]
  ;<  ~  bind:m  (poke-app [~nec %groups] group-action-4+a-groups)
  ;<  bud-tok=token:g  bind:m  (wait-for-token-add ~nec my-test-flag ~bud)
  ;<  ~  bind:m  (ex-foreign-invite-valid ~bud my-test-flag ~nec &)
  ::  ~nec invites ~wes with ~bud's personal token, and her client
  ::  rejects the invitation. the poke is sent as +poke-app sends it,
  ::  but its acknowledgement is expected to be a nack.
  ::
  =/  =a-groups:v8:gv  [%invite my-test-flag (sy ~wes ~) [`bud-tok ~]]
  =/  =page  group-action-4+a-groups
  =/  =task:gall
    [%deal [~nec ~nec /aqua] %groups %raw-poke page]
  =/  =aqua-event  [%event ~nec /g/aqua/deal task]
  ;<  ~  bind:m  (send-events ~[aqua-event])
  ;<  =aqua-effect  bind:m  (take-effect /effect/unto)
  ;<  ~  bind:m  (ex-equal !>(who.aqua-effect) !>(~nec))
  =*  effect  q.ufs.aqua-effect
  ;<  ~  bind:m  (ex-equal !>(`@tas`-.effect) !>(%unto))
  ?>  ?=(%unto -.effect)
  ;<  ~  bind:m  (ex-equal !>(`@tas`-.p.effect) !>(%poke-ack))
  ?>  ?=(%poke-ack -.p.effect)
  ;<  ~  bind:m  (ex-equal !>(?=(^ p.p.effect)) !>(&))
  ::  ~nec records no invite of ~wes and keeps her invite of ~bud.
  ::
  ;<  ~  bind:m  (ex-invited ~nec ~zod ~wes |)
  ;<  ~  bind:m  (ex-invited ~nec ~zod ~bud &)
  ::  ~nec invites ~wes without a token, and receives the addition of a
  ::  personal token for ~wes before ~wes receives the invitation.
  ::
  =/  =a-groups:v8:gv  [%invite my-test-flag (sy ~wes ~) [~ ~]]
  ;<  ~  bind:m  (poke-app [~nec %groups] group-action-4+a-groups)
  ;<  wes-tok=token:g  bind:m  (wait-for-token-add ~nec my-test-flag ~wes)
  ;<  ~  bind:m  (ex-not-equal !>(wes-tok) !>(bud-tok))
  ::  ~wes receives this invitation as her first, from ~nec and with
  ::  her own token, and ~nec records her as invited.
  ::
  ;<  =foreigns:v8:gv  bind:m
    %^  wait-for-app-fact-value  foreigns:v8:gv
      /~wes/groups/v1/foreigns
    [~wes %groups]
  =/  far=(unit foreign:v8:gv)  (~(get by foreigns) my-test-flag)
  ;<  ~  bind:m  (ex-equal !>(?=(^ far)) !>(&))
  ?>  ?=(^ far)
  ;<  ~  bind:m  (ex-equal !>((lent invites.u.far)) !>(1))
  ?>  ?=(^ invites.u.far)
  ;<  ~  bind:m  (ex-equal !>(from.i.invites.u.far) !>(~nec))
  ;<  ~  bind:m
    (ex-equal !>(token.i.invites.u.far) !>(`(unit token:g)`[~ wes-tok]))
  ;<  ~  bind:m  (ex-equal !>(valid.i.invites.u.far) !>(&))
  ;<  ~  bind:m  (ex-invited ~nec ~zod ~wes &)
  ::  ~bud still holds ~nec's valid invitation with her token.
  ::
  ;<  foreign=(unit foreign:v10:gv)  bind:m  (scry-test-foreign ~bud ~zod)
  ;<  ~  bind:m  (ex-equal !>(?=(^ foreign)) !>(&))
  ?>  ?=(^ foreign)
  ;<  ~  bind:m  (ex-equal !>(?=(^ invites.u.foreign)) !>(&))
  ?>  ?=(^ invites.u.foreign)
  ;<  ~  bind:m  (ex-equal !>(from.i.invites.u.foreign) !>(~nec))
  ;<  ~  bind:m
    (ex-equal !>(token.i.invites.u.foreign) !>(`(unit token:g)`[~ bud-tok]))
  ;<  ~  bind:m  (ex-equal !>(valid.i.invites.u.foreign) !>(&))
  (pure:m ~)
::  +ph-test-group-seat-before-join-keeps-invite: test an admin keeping the invite of a seated ship
::
::  scenario
::
::  ~zod hosts a private group with ~nec as an admin, and ~nec joins
::  the group. ~nec then invites ~bud, and receives the addition of
::  ~bud's personal token, and ~bud then receives the invitation. ~nec
::  records ~bud as invited. ~nec then seats ~bud, and receives ~bud's
::  seat with the default joined time and then the addition of a
::  second personal token for ~bud, and ~bud then receives ~zod's
::  invitation for her seat. ~nec still records ~bud as invited, since
::  a seat without a joined time does not prune her invite, and ~zod
::  records her as invited too and holds both of her personal tokens.
::  ~bud then joins without a token, admitted by her seat, and ~zod
::  spends both tokens. ~nec receives ~bud's joined seat and then the
::  deletion of both tokens. ~zod and ~nec then drop their invited
::  records of ~bud, and neither holds a personal token for her.
::
++  ph-test-group-seat-before-join-keeps-invite
  =/  m  (strand ,~)
  ^-  form:m
  ;<  ~  bind:m  (watch-app /~nec/groups/v1/groups [~nec %groups] /v1/groups)
  ;<  ~  bind:m  (watch-app /~nec/groups/v1/foreigns [~nec %groups] /v1/foreigns)
  ;<  ~  bind:m  (watch-app /~bud/groups/v1/groups [~bud %groups] /v1/groups)
  ;<  ~  bind:m  (watch-app /~bud/groups/v1/foreigns [~bud %groups] /v1/foreigns)
  ::  ~zod hosts a private group with ~nec as an admin, then ~nec joins
  ::  the group.
  ::
  ;<  ~  bind:m  (create-test-group ~zod %private (my ~nec^(sy %admin ~) ~))
  ;<  *  bind:m  (wait-for-app-fact /~nec/groups/v1/foreigns [~nec %groups])
  ;<  ~  bind:m  (join-test-group ~nec ~zod)
  ;<  ~  bind:m  (ex-r-groups-fact-match-tag ~nec my-test-flag %create)
  ::  ~nec invites ~bud. the token addition on ~nec's updates and the
  ::  token on her watch leave ~zod in one event, so the addition is
  ::  awaited first. this is emission order under aqua, not causal
  ::  order, and a reversal would time out rather than pass.
  ::  ~nec records ~bud as invited.
  ::
  =/  =a-groups:v8:gv  [%invite my-test-flag (sy ~bud ~) [~ ~]]
  ;<  ~  bind:m  (poke-app [~nec %groups] group-action-4+a-groups)
  ;<  tok-1=token:g  bind:m  (wait-for-token-add ~nec my-test-flag ~bud)
  ;<  ~  bind:m  (ex-foreign-invite-valid ~bud my-test-flag ~nec &)
  ;<  ~  bind:m  (ex-invited ~nec ~zod ~bud &)
  ::  ~nec seats ~bud. ~zod gives the seat with the default joined
  ::  time, then mints a second personal token for ~bud, and only then
  ::  sends ~bud the invitation for her seat, so the responses to ~nec
  ::  are awaited first, in that order.
  ::
  =/  =a-groups:v8:gv  [%group my-test-flag [%seat (sy ~bud ~) [%add ~]]]
  ;<  ~  bind:m  (poke-app [~nec %groups] group-action-4+a-groups)
  ;<  r=r-group:v10:gv  bind:m
    %^  wait-for-r-group  ~nec  my-test-flag
    |=  r=r-group:v10:gv
    ?:  ?=(%seat -.r)  &
    ?.  ?=(%entry -.r)  |
    ?.  ?=(%token -.r-entry.r)  |
    ?.  ?=(%add -.r-token.r-entry.r)  |
    =([%personal ~bud] scheme.meta.r-token.r-entry.r)
  ;<  ~  bind:m  (ex-equal !>(`@tas`-.r) !>(%seat))
  ?>  ?=(%seat -.r)
  ;<  ~  bind:m  (ex-equal !>(ships.r) !>((sy ~bud ~)))
  ;<  ~  bind:m  (ex-equal !>(`@tas`-.r-seat.r) !>(%add))
  ?>  ?=(%add -.r-seat.r)
  ;<  ~  bind:m  (ex-equal !>(joined.seat.r-seat.r) !>(*@da))
  ;<  tok-2=token:g  bind:m  (wait-for-token-add ~nec my-test-flag ~bud)
  ;<  ~  bind:m  (ex-not-equal !>(tok-2) !>(tok-1))
  ;<  ~  bind:m  (ex-foreign-invite-valid ~bud my-test-flag ~zod &)
  ::  ~nec still records ~bud as invited, and ~zod records her as
  ::  invited too and holds both of her personal tokens.
  ::
  ;<  ~  bind:m  (ex-invited ~nec ~zod ~bud &)
  ;<  ~  bind:m  (ex-invited ~zod ~zod ~bud &)
  ;<  =group:v11:gv  bind:m  (scry-test-group ~zod ~zod)
  =/  bud-tokens=(set token:g)  (personal-tokens group ~bud)
  ;<  ~  bind:m  (ex-equal !>(bud-tokens) !>((sy tok-1 tok-2 ~)))
  ::  ~bud joins the group without a token.
  ::
  =/  =a-foreigns:v8:gv  [%foreign my-test-flag %join ~]
  ;<  ~  bind:m  (poke-app [~bud %groups] group-foreign-2+a-foreigns)
  ::  ~nec receives ~bud's joined seat, then exactly the deletions of
  ::  both of ~bud's tokens. a deletion of ~bud's token ends the skip
  ::  and fails the seat check. ~zod sends these before serving ~bud
  ::  the group, so they are awaited before ~bud's creation fact.
  ::
  ;<  r=r-group:v10:gv  bind:m
    %^  wait-for-r-group  ~nec  my-test-flag
    |=  r=r-group:v10:gv
    ?:  ?=(%seat -.r)  &
    ?.  ?=(%entry -.r)  |
    ?.  ?=(%token -.r-entry.r)  |
    ?.  ?=(%del -.r-token.r-entry.r)  |
    (~(has in bud-tokens) token.r-token.r-entry.r)
  ;<  ~  bind:m  (ex-equal !>(`@tas`-.r) !>(%seat))
  ?>  ?=(%seat -.r)
  ;<  ~  bind:m  (ex-equal !>(ships.r) !>((sy ~bud ~)))
  ;<  ~  bind:m  (ex-equal !>(`@tas`-.r-seat.r) !>(%add))
  ?>  ?=(%add -.r-seat.r)
  ;<  ~  bind:m  (ex-not-equal !>(joined.seat.r-seat.r) !>(*@da))
  ;<  del-1=token:g  bind:m  (ex-r-groups-token-del ~nec my-test-flag)
  ;<  del-2=token:g  bind:m  (ex-r-groups-token-del ~nec my-test-flag)
  ;<  ~  bind:m  (ex-equal !>((sy del-1 del-2 ~)) !>(bud-tokens))
  ;<  ~  bind:m  (ex-r-groups-fact-match-tag ~bud my-test-flag %create)
  ::  ~zod and ~nec drop their invited records of ~bud, and neither
  ::  holds a personal token for her.
  ::
  ;<  ~  bind:m  (ex-invited ~nec ~zod ~bud |)
  ;<  ~  bind:m  (ex-invited ~zod ~zod ~bud |)
  ;<  =group:v11:gv  bind:m  (scry-test-group ~zod ~zod)
  ;<  ~  bind:m  (ex-equal !>((personal-tokens group ~bud)) !>(*(set token:g)))
  ;<  =group:v11:gv  bind:m  (scry-test-group ~nec ~zod)
  ;<  ~  bind:m  (ex-equal !>((personal-tokens group ~bud)) !>(*(set token:g)))
  (pure:m ~)
::  +ph-test-group-subscriber-revokes-on-token-delete: test an admin revoking her invite on token deletion
::
::  scenario
::
::  ~zod hosts a private group with ~nec as an admin, and ~nec joins
::  the group. ~nec then invites ~bud, and receives the addition of
::  ~bud's personal token, and ~bud then receives the invitation. ~nec
::  records ~bud as invited, ~zod does not, and ~zod holds the token.
::  ~zod then deletes the token, and ~nec receives its deletion. ~nec
::  then revokes her invitation, and ~bud receives it revoked. ~nec
::  drops her invited record of ~bud, and neither ~zod nor ~nec holds
::  a personal token for her. ~bud then attempts to join with the
::  deleted token, and ~zod denies her. ~bud then ends the join with
::  an error, and does not hold the group.
::
++  ph-test-group-subscriber-revokes-on-token-delete
  =/  m  (strand ,~)
  ^-  form:m
  ;<  ~  bind:m  (watch-app /~nec/groups/v1/groups [~nec %groups] /v1/groups)
  ;<  ~  bind:m  (watch-app /~nec/groups/v1/foreigns [~nec %groups] /v1/foreigns)
  ;<  ~  bind:m  (watch-app /~bud/groups/v1/groups [~bud %groups] /v1/groups)
  ;<  ~  bind:m  (watch-app /~bud/groups/v1/foreigns [~bud %groups] /v1/foreigns)
  ::  ~zod hosts a private group with ~nec as an admin, then ~nec joins
  ::  the group.
  ::
  ;<  ~  bind:m  (create-test-group ~zod %private (my ~nec^(sy %admin ~) ~))
  ;<  *  bind:m  (wait-for-app-fact /~nec/groups/v1/foreigns [~nec %groups])
  ;<  ~  bind:m  (join-test-group ~nec ~zod)
  ;<  ~  bind:m  (ex-r-groups-fact-match-tag ~nec my-test-flag %create)
  ::  ~nec invites ~bud. the token addition on ~nec's updates and the
  ::  token on her watch leave ~zod in one event, so the addition is
  ::  awaited first. this is emission order under aqua, not causal
  ::  order, and a reversal would time out rather than pass.
  ::
  =/  =a-groups:v8:gv  [%invite my-test-flag (sy ~bud ~) [~ ~]]
  ;<  ~  bind:m  (poke-app [~nec %groups] group-action-4+a-groups)
  ;<  tok=token:g  bind:m  (wait-for-token-add ~nec my-test-flag ~bud)
  ;<  ~  bind:m  (ex-foreign-invite-valid ~bud my-test-flag ~nec &)
  ::  ~nec records ~bud as invited, ~zod does not, and ~zod holds the
  ::  token.
  ::
  ;<  ~  bind:m  (ex-invited ~nec ~zod ~bud &)
  ;<  ~  bind:m  (ex-invited ~zod ~zod ~bud |)
  ;<  =group:v11:gv  bind:m  (scry-test-group ~zod ~zod)
  ;<  ~  bind:m  (ex-equal !>((personal-tokens group ~bud)) !>((sy tok ~)))
  ::  ~zod deletes the token, and ~nec receives exactly its deletion.
  ::  ~nec revokes her invitation only once she takes the deletion, so
  ::  ~bud's revoked invitation is awaited after it.
  ::
  =/  =a-groups:v8:gv  [%group my-test-flag [%entry [%token [%del tok]]]]
  ;<  ~  bind:m  (poke-app [~zod %groups] group-action-4+a-groups)
  ;<  del=token:g  bind:m  (ex-r-groups-token-del ~nec my-test-flag)
  ;<  ~  bind:m  (ex-equal !>(del) !>(tok))
  ;<  ~  bind:m  (ex-foreign-invite-valid ~bud my-test-flag ~nec |)
  ::  ~nec drops her invited record of ~bud, and neither ~zod nor ~nec
  ::  holds a personal token for her.
  ::
  ;<  ~  bind:m  (ex-invited ~nec ~zod ~bud |)
  ;<  =group:v11:gv  bind:m  (scry-test-group ~zod ~zod)
  ;<  ~  bind:m  (ex-equal !>((personal-tokens group ~bud)) !>(*(set token:g)))
  ;<  =group:v11:gv  bind:m  (scry-test-group ~nec ~zod)
  ;<  ~  bind:m  (ex-equal !>((personal-tokens group ~bud)) !>(*(set token:g)))
  ::  ~bud attempts to join with the deleted token, and ~zod denies her.
  ::  ~bud then ends the join with an error, and does not hold the
  ::  group.
  ::
  =/  =a-foreigns:v8:gv  [%foreign my-test-flag %join `tok]
  ;<  ~  bind:m  (poke-app [~bud %groups] group-foreign-2+a-foreigns)
  ;<  *  bind:m
    %^  wait-for-foreign  ~bud  my-test-flag
    |=(far=foreign:v8:gv =([~ %error] progress.far))
  ;<  foreign=(unit foreign:v10:gv)  bind:m  (scry-test-foreign ~bud ~zod)
  ;<  ~  bind:m  (ex-equal !>(?=(^ foreign)) !>(&))
  ?>  ?=(^ foreign)
  ;<  ~  bind:m
    (ex-equal !>(progress.u.foreign) !>(`(unit progress:v10:gv)`[~ %error]))
  ;<  =bowl:strand  bind:m  get-bowl
  =/  aqua-pax
    /gx/~bud/groups/(scot %da now.bowl)/v3/groups/~zod/my-test-group/noun
  ;<  group=(unit group:v11:gv)  bind:m
    (scry-aqua (unit group:v11:gv) ~bud aqua-pax)
  ;<  ~  bind:m  (ex-equal !>(?=(~ group)) !>(&))
  (pure:m ~)
::  +ph-test-group-invite-during-join: test invites arriving during and after a join
::
::  scenario
::
::  ~zod hosts a private group with ~nec as an admin, and ~nec joins
::  the group. ~zod then invites ~bud, and ~bud receives the
::  invitation, and ~zod holds a personal token for her. ~nec then
::  invites ~bud too, and ~bud receives the invitation. ~bud then
::  joins with ~zod's token, and keeps both invitations while her
::  join is in progress. ~zod then admits ~bud and spends both tokens, and
::  ~nec receives ~bud's seat and then the deletion of both tokens.
::  ~bud then receives the group, and drops her foreign record of it.
::  ~zod and ~nec drop their invited records of ~bud, and neither
::  holds a personal token for her.
::
::  ~bud is then poked with an invitation from ~nec, and drops it,
::  since she holds the group: she acknowledges it, creates no foreign
::  record, and still holds the group. ~bud is then poked with a
::  revocation of that invitation's token, and acknowledges it without
::  creating a foreign record.
::
++  ph-test-group-invite-during-join
  =/  m  (strand ,~)
  ^-  form:m
  ;<  ~  bind:m  (watch-app /~nec/groups/v1/groups [~nec %groups] /v1/groups)
  ;<  ~  bind:m  (watch-app /~nec/groups/v1/foreigns [~nec %groups] /v1/foreigns)
  ;<  ~  bind:m  (watch-app /~bud/groups/v1/groups [~bud %groups] /v1/groups)
  ;<  ~  bind:m  (watch-app /~bud/groups/v1/foreigns [~bud %groups] /v1/foreigns)
  ::  ~zod hosts a private group with ~nec as an admin, then ~nec joins
  ::  the group.
  ::
  ;<  ~  bind:m  (create-test-group ~zod %private (my ~nec^(sy %admin ~) ~))
  ;<  *  bind:m  (wait-for-app-fact /~nec/groups/v1/foreigns [~nec %groups])
  ;<  ~  bind:m  (join-test-group ~nec ~zod)
  ;<  ~  bind:m  (ex-r-groups-fact-match-tag ~nec my-test-flag %create)
  ::  ~zod invites ~bud, and ~bud receives the invitation. ~zod holds a
  ::  personal token for ~bud.
  ::
  =/  =a-groups:v8:gv  [%invite my-test-flag (sy ~bud ~) [~ ~]]
  ;<  ~  bind:m  (poke-app [~zod %groups] group-action-4+a-groups)
  ;<  ~  bind:m  (ex-foreign-invite-valid ~bud my-test-flag ~zod &)
  ;<  =group:v11:gv  bind:m  (scry-test-group ~zod ~zod)
  =/  bud-tokens=(set token:g)  (personal-tokens group ~bud)
  ;<  ~  bind:m  (ex-equal !>(~(wyt in bud-tokens)) !>(1))
  ?>  ?=([* ~ ~] bud-tokens)
  =/  zod-tok=token:g  n.bud-tokens
  ::  ~nec invites ~bud too, and ~bud receives the invitation.
  ::
  =/  =a-groups:v8:gv  [%invite my-test-flag (sy ~bud ~) [~ ~]]
  ;<  ~  bind:m  (poke-app [~nec %groups] group-action-4+a-groups)
  ;<  ~  bind:m  (ex-foreign-invite-valid ~bud my-test-flag ~nec &)
  ;<  foreign=(unit foreign:v10:gv)  bind:m  (scry-test-foreign ~bud ~zod)
  ;<  ~  bind:m  (ex-equal !>(?=(^ foreign)) !>(&))
  ?>  ?=(^ foreign)
  ?>  ?=([* * ~] invites.u.foreign)
  =/  nec-inv=(unit token:g)  token.i.invites.u.foreign
  ;<  ~  bind:m  (ex-equal !>(?=(^ nec-inv)) !>(&))
  ?>  ?=(^ nec-inv)
  =/  nec-tok=token:g  u.nec-inv
  ;<  ~  bind:m  (ex-not-equal !>(nec-tok) !>(zod-tok))
  ::  ~bud joins with ~zod's token. while her join is in progress,
  ::  she keeps both invitations, newest first.
  ::
  =/  =a-foreigns:v8:gv  [%foreign my-test-flag %join `zod-tok]
  ;<  ~  bind:m  (poke-app [~bud %groups] group-foreign-2+a-foreigns)
  ;<  foreign=(unit foreign:v10:gv)  bind:m  (scry-test-foreign ~bud ~zod)
  ;<  ~  bind:m  (ex-equal !>(?=(^ foreign)) !>(&))
  ?>  ?=(^ foreign)
  ;<  ~  bind:m  (ex-equal !>(?=(^ progress.u.foreign)) !>(&))
  ;<  ~  bind:m
    %+  ex-equal
      !>((turn invites.u.foreign |=(=invite:v8:gv from.invite)))
    !>(`(list ship)`~[~nec ~zod])
  ;<  ~  bind:m
    %+  ex-equal
      !>((turn invites.u.foreign |=(=invite:v8:gv valid.invite)))
    !>(`(list ?)`~[& &])
  ::  ~nec receives ~bud's seat, then exactly the deletions of both of
  ::  ~bud's tokens. a deletion of ~bud's token ends the skip and fails
  ::  the seat check. ~zod sends these before serving ~bud the group,
  ::  so they are awaited before ~bud's creation fact.
  ::
  =/  bud-tokens=(set token:g)  (sy zod-tok nec-tok ~)
  ;<  r=r-group:v10:gv  bind:m
    %^  wait-for-r-group  ~nec  my-test-flag
    |=  r=r-group:v10:gv
    ?:  ?=(%seat -.r)  &
    ?.  ?=(%entry -.r)  |
    ?.  ?=(%token -.r-entry.r)  |
    ?.  ?=(%del -.r-token.r-entry.r)  |
    (~(has in bud-tokens) token.r-token.r-entry.r)
  ;<  ~  bind:m  (ex-equal !>(`@tas`-.r) !>(%seat))
  ?>  ?=(%seat -.r)
  ;<  ~  bind:m  (ex-equal !>(ships.r) !>((sy ~bud ~)))
  ;<  ~  bind:m  (ex-equal !>(`@tas`-.r-seat.r) !>(%add))
  ?>  ?=(%add -.r-seat.r)
  ;<  ~  bind:m  (ex-not-equal !>(joined.seat.r-seat.r) !>(*@da))
  ;<  del-1=token:g  bind:m  (ex-r-groups-token-del ~nec my-test-flag)
  ;<  del-2=token:g  bind:m  (ex-r-groups-token-del ~nec my-test-flag)
  ;<  ~  bind:m  (ex-equal !>((sy del-1 del-2 ~)) !>(bud-tokens))
  ;<  ~  bind:m  (ex-r-groups-fact-match-tag ~bud my-test-flag %create)
  ::  ~bud drops her foreign record of the group. ~zod and ~nec drop
  ::  their invited records of ~bud, and neither holds a personal token
  ::  for her.
  ::
  ;<  foreign=(unit foreign:v10:gv)  bind:m  (scry-test-foreign ~bud ~zod)
  ;<  ~  bind:m  (ex-equal !>(foreign) !>(`(unit foreign:v10:gv)`~))
  ;<  ~  bind:m  (ex-invited ~nec ~zod ~bud |)
  ;<  ~  bind:m  (ex-invited ~zod ~zod ~bud |)
  ;<  =group:v11:gv  bind:m  (scry-test-group ~zod ~zod)
  ;<  ~  bind:m  (ex-equal !>((personal-tokens group ~bud)) !>(*(set token:g)))
  ;<  =group:v11:gv  bind:m  (scry-test-group ~nec ~zod)
  ;<  ~  bind:m  (ex-equal !>((personal-tokens group ~bud)) !>(*(set token:g)))
  ::  ~bud is poked with an invitation from ~nec, and drops it, since
  ::  she holds the group. she acknowledges it without creating a
  ::  foreign record, and still holds the group. the poke comes from
  ::  ~bud herself, so an invitation that was not dropped would fail
  ::  the check of its sender, and the poke would be nacked.
  ::
  ;<  =bowl:strand  bind:m  get-bowl
  =/  =invite:v8:gv
    :*  my-test-flag
        now.bowl
        ~nec
        `0v123          ::  token
        ~               ::  note
        *preview:v8:gv  ::  preview
        &
    ==
  =/  =a-foreigns:v8:gv  [%invite invite]
  ;<  ~  bind:m  (poke-app [~bud %groups] group-foreign-2+a-foreigns)
  ;<  foreign=(unit foreign:v10:gv)  bind:m  (scry-test-foreign ~bud ~zod)
  ;<  ~  bind:m  (ex-equal !>(foreign) !>(`(unit foreign:v10:gv)`~))
  ;<  *  bind:m  (scry-test-group ~bud ~zod)
  ::  ~bud is poked with a revocation of the token of that invitation,
  ::  and acknowledges it without creating a foreign record.
  ::
  =/  =a-foreigns:v8:gv  [%revoke my-test-flag token.invite]
  ;<  ~  bind:m  (poke-app [~bud %groups] group-foreign-2+a-foreigns)
  ;<  foreign=(unit foreign:v10:gv)  bind:m  (scry-test-foreign ~bud ~zod)
  ;<  ~  bind:m  (ex-equal !>(foreign) !>(`(unit foreign:v10:gv)`~))
  (pure:m ~)
::  +ph-test-group-join-private-pending-invite: test private group pending invitations
::
::  scenario
::
::  ~zod hosts a private group and adds ~bud to the pending list with
::  the admin role. ~bud receives the pending invitation and joins the
::  group successfully, receiving the group creation fact with the
::  admin role preserved.
::
++  ph-test-group-join-private-pending-invite
  =/  m  (strand ,~)
  ^-  form:m
  ;<  ~  bind:m  (watch-app /~zod/groups/v1/groups [~zod %groups] /v1/groups)
  ;<  ~  bind:m  (watch-app /~bud/groups/v1/groups [~bud %groups] /v1/groups)
  ;<  ~  bind:m  (watch-app /~bud/groups/v1/foreigns [~bud %groups] /v1/foreigns)
  ::
  ::  ~zod hosts a private group, then adds ~bud to the pending list.
  ::
  ;<  ~  bind:m  (create-test-group ~zod %private ~)
  ;<  ~  bind:m  (ex-r-groups-fact-match-tag ~zod ~zod^%my-test-group %create)
  =/  roles=(set role-id:g)  (sy %admin ~)
  =/  =c-groups:g
    [%group my-test-flag [%entry [%pending (sy ~bud ~) [%add roles]]]]
  ;<  ~  bind:m  (poke-app [~zod %groups] group-command+c-groups)
  ::  ~zod first records the generated invite token, then the pending entry.
  ::
  ;<  ~  bind:m  (ex-r-groups-fact-match-tag ~zod ~zod^%my-test-group %entry)
  ;<  ~  bind:m
    (ex-r-groups ~zod [my-test-flag [%entry [%pending [%add (sy ~bud ~) roles]]]])
  ::  ~bud receives the pending invitation and joins the group.
  ::
  ;<  *  bind:m  (wait-for-app-fact /~bud/groups/v1/foreigns [~bud %groups])
  ;<  ~  bind:m  (join-test-group ~bud ~zod)
  ;<  ~  bind:m
    %^  (ex-app-fact-match r-groups:v10:gv)  /~bud/groups/v1/groups
      [~bud %groups]
    :-  %group-response-1
    |=  rep=r-groups:v10:gv
    ;<  ~  bind:m  (ex-equal !>(flag.rep) !>(my-test-flag))
    ?>  ?=(%create -.r-group.rep)
    =/  =seat:g  (~(got by seats.group.r-group.rep) ~bud)
    (ex-equal !>(roles.seat) !>(roles))
  (pure:m ~)
::  +ph-test-group-join-public: test public group joins
::
::  scenario
::
::  ~zod hosts a public group.
::  ~bud joins the group successfully without an invitation,
::  receiving the group creation fact.
::
++  ph-test-group-join-public
  =/  m  (strand ,~)
  ^-  form:m
  ;<  ~  bind:m  (watch-app /~bud/groups/v1/groups [~bud %groups] /v1/groups)
  ::
  ;<  ~  bind:m  (create-test-group ~zod %public ~)
  ;<  ~  bind:m  (join-test-group ~bud ~zod)
  ;<  ~  bind:m  (ex-r-groups-fact-match-tag ~bud ~zod^%my-test-group %create)
  (pure:m ~)
::  +ph-test-group-join-public-ask: test public group joins by ask request
::
::  scenario
::
::  ~zod hosts a public group.
::  ~bud asks to join the group and joins successfully without approval,
::  receiving the group creation fact.
::
++  ph-test-group-join-public-ask
  =/  m  (strand ,~)
  ^-  form:m
  ;<  ~  bind:m  (watch-app /~bud/groups/v1/groups [~bud %groups] /v1/groups)
  ::
  ;<  ~  bind:m  (create-test-group ~zod %public ~)
  =/  =a-foreigns:v8:gv
    [%foreign my-test-flag %ask ~]
  ;<  ~  bind:m  (poke-app [~bud %groups] group-foreign-2+a-foreigns)
  ;<  ~  bind:m  (ex-r-groups-fact-match-tag ~bud ~zod^%my-test-group %create)
  (pure:m ~)
::  +ph-test-group-ban-kicks-member: test banning a group member
::
::  scenario
::
::  ~zod hosts a public group. ~bud joins the group successfully.
::  ~zod bans ~bud, then ~bud receives the group deletion fact.
::
++  ph-test-group-ban-kicks-member
  =/  m  (strand ,~)
  ^-  form:m
  ;<  ~  bind:m  (watch-app /~bud/groups/v1/groups [~bud %groups] /v1/groups)
  ::
  ;<  ~  bind:m  (create-test-group ~zod %public ~)
  ;<  ~  bind:m  (join-test-group ~bud ~zod)
  ;<  ~  bind:m  (ex-r-groups-fact-match-tag ~bud my-test-flag %create)
  =/  =c-groups:g
    [%group my-test-flag [%entry [%ban [%add-ships (sy ~bud ~)]]]]
  ;<  ~  bind:m  (poke-app [~zod %groups] group-command+c-groups)
  ;<  ~  bind:m  (ex-r-groups-fact-match-tag ~bud my-test-flag %seat)
  ;<  ~  bind:m  (ex-r-groups-fact-match-tag ~bud my-test-flag %delete)
  (pure:m ~)
::  +ph-test-group-preview-public: test public group previews
::
::  scenario
::
::  ~zod hosts a public group and updates its metadata.
::  ~bud previews the group and receives the updated group preview.
::
++  ph-test-group-preview-public
  =/  m  (strand ,~)
  ^-  form:m
  =/  meta=data:meta:g  ['Public Group' 'A public group' '' '']
  ;<  ~  bind:m  (create-test-group ~zod %public ~)
  =/  =c-groups:g  [%group my-test-flag [%meta meta]]
  ;<  ~  bind:m  (poke-app [~zod %groups] group-command+c-groups)
  ;<  ~  bind:m  (watch-app /~bud/groups/v1/foreigns/~zod/my-test-group/preview [~bud %groups] /v1/foreigns/~zod/my-test-group/preview)
  ;<  ~  bind:m  (ex-group-preview ~bud my-test-flag meta)
  (pure:m ~)
::  +ph-test-group-preview-private: test private group previews
::
::  scenario
::
::  ~zod hosts a private group and updates its metadata.
::  ~bud previews the group and receives the updated group preview.
::
++  ph-test-group-preview-private
  =/  m  (strand ,~)
  ^-  form:m
  =/  meta=data:meta:g  ['Private Group' 'A private group' '' '']
  ;<  ~  bind:m  (create-test-group ~zod %private ~)
  =/  =c-groups:g  [%group my-test-flag [%meta meta]]
  ;<  ~  bind:m  (poke-app [~zod %groups] group-command+c-groups)
  ;<  ~  bind:m  (watch-app /~bud/groups/v1/foreigns/~zod/my-test-group/preview [~bud %groups] /v1/foreigns/~zod/my-test-group/preview)
  ;<  ~  bind:m  (ex-group-preview ~bud my-test-flag meta)
  (pure:m ~)
::  +ph-test-group-preview-secret: test secret group previews
::
::  scenario
::
::  ~zod hosts a secret group and updates its metadata.
::  ~bud previews the group and receives no group preview.
::
++  ph-test-group-preview-secret
  =/  m  (strand ,~)
  ^-  form:m
  =/  meta=data:meta:g  ['Secret Group' 'A secret group' '' '']
  ;<  ~  bind:m  (create-test-group ~zod %secret ~)
  =/  =c-groups:g  [%group my-test-flag [%meta meta]]
  ;<  ~  bind:m  (poke-app [~zod %groups] group-command+c-groups)
  ;<  ~  bind:m  (watch-app /~bud/groups/v1/foreigns/~zod/my-test-group/preview [~bud %groups] /v1/foreigns/~zod/my-test-group/preview)
  ;<  ~  bind:m
    %^  (ex-app-fact-match preview-update:v10:gv)
      /~bud/groups/v1/foreigns/~zod/my-test-group/preview
      [~bud %groups]
    :-  %group-preview-3
    |=  update=preview-update:v10:gv
    (ex-equal !>(update) !>(~))
  (pure:m ~)
::  +ph-test-group-public-invite-revoke-delete: test public invite revocation on group delete
::
::  scenario
::
::  ~zod hosts a public group and invites ~bud.
::  ~bud receives the invitation. ~zod deletes the group, then ~bud
::  receives a revoked invitation.
::
++  ph-test-group-public-invite-revoke-delete
  =/  m  (strand ,~)
  ^-  form:m
  ;<  ~  bind:m  (watch-app /~bud/groups/v1/foreigns [~bud %groups] /v1/foreigns)
  ::
  ;<  ~  bind:m  (create-test-group ~zod %public ~)
  =/  =a-groups:v8:gv  [%invite my-test-flag (sy ~bud ~) [~ ~]]
  ;<  ~  bind:m  (poke-app [~zod %groups] group-action-4+a-groups)
  ;<  ~  bind:m  (ex-foreign-invite-valid ~bud my-test-flag ~zod &)
  =/  =c-groups:g  [%group my-test-flag [%delete ~]]
  ;<  ~  bind:m  (poke-app [~zod %groups] group-command+c-groups)
  ;<  ~  bind:m  (ex-foreign-invite-valid ~bud my-test-flag ~zod |)
  (pure:m ~)
::  +ph-test-group-public-invite-revoke-ban: test public invite revocation on ban
::
::  scenario
::
::  ~zod hosts a public group and invites ~bud as an admin.
::  ~bud joins the group and invites ~nec. ~nec receives the invitation.
::  ~bud bans ~nec, then ~nec receives a revoked invitation.
::
++  ph-test-group-public-invite-revoke-ban
  =/  m  (strand ,~)
  ^-  form:m
  ;<  ~  bind:m  (watch-app /~bud/groups/v1/groups [~bud %groups] /v1/groups)
  ;<  ~  bind:m  (watch-app /~bud/groups/v1/foreigns [~bud %groups] /v1/foreigns)
  ;<  ~  bind:m  (watch-app /~nec/groups/v1/foreigns [~nec %groups] /v1/foreigns)
  ::
  ;<  ~  bind:m  (create-test-group ~zod %public (my ~bud^(sy %admin ~) ~))
  ;<  *  bind:m  (wait-for-app-fact /~bud/groups/v1/foreigns [~bud %groups])
  ;<  ~  bind:m  (join-test-group ~bud ~zod)
  ;<  ~  bind:m  (ex-r-groups-fact-match-tag ~bud my-test-flag %create)
  =/  =a-groups:v8:gv  [%invite my-test-flag (sy ~nec ~) [~ ~]]
  ;<  ~  bind:m  (poke-app [~bud %groups] group-action-4+a-groups)
  ;<  ~  bind:m  (ex-foreign-invite-valid ~nec my-test-flag ~bud &)
  =/  =a-groups:v8:gv
    [%group my-test-flag [%entry [%ban [%add-ships (sy ~nec ~)]]]]
  ;<  ~  bind:m  (poke-app [~bud %groups] group-action-4+a-groups)
  ;<  ~  bind:m  (ex-foreign-invite-valid ~nec my-test-flag ~bud |)
  (pure:m ~)
::  +ph-test-group-public-invite-revoke-pending: test public invite revocation on pending delete
::
::  scenario
::
::  ~zod hosts a public group and invites ~bud as an admin.
::  ~bud joins the group and adds ~nec to the pending list.
::  ~nec receives the invitation. ~zod removes ~nec from the pending
::  list, then ~nec receives a revoked invitation.
::
++  ph-test-group-public-invite-revoke-pending
  =/  m  (strand ,~)
  ^-  form:m
  ;<  ~  bind:m  (watch-app /~bud/groups/v1/groups [~bud %groups] /v1/groups)
  ;<  ~  bind:m  (watch-app /~bud/groups/v1/foreigns [~bud %groups] /v1/foreigns)
  ;<  ~  bind:m  (watch-app /~nec/groups/v1/foreigns [~nec %groups] /v1/foreigns)
  ::
  ;<  ~  bind:m  (create-test-group ~zod %public (my ~bud^(sy %admin ~) ~))
  ;<  *  bind:m  (wait-for-app-fact /~bud/groups/v1/foreigns [~bud %groups])
  ;<  ~  bind:m  (join-test-group ~bud ~zod)
  ;<  ~  bind:m  (ex-r-groups-fact-match-tag ~bud my-test-flag %create)
  =/  =a-groups:v8:gv
    [%group my-test-flag [%entry [%pending (sy ~nec ~) [%add ~]]]]
  ;<  ~  bind:m  (poke-app [~bud %groups] group-action-4+a-groups)
  ;<  ~  bind:m  (ex-foreign-invite-valid ~nec my-test-flag ~zod &)
  =/  =a-groups:v8:gv
    [%group my-test-flag [%entry [%pending (sy ~nec ~) [%del ~]]]]
  ;<  ~  bind:m  (poke-app [~zod %groups] group-action-4+a-groups)
  ;<  ~  bind:m  (ex-foreign-invite-valid ~nec my-test-flag ~zod |)
  (pure:m ~)
::  +ph-test-group-invite-revoke-inviter-leave: test invite revocation on inviter leave
::
::  scenario
::
::  ~zod hosts a private group and invites ~bud as an admin.
::  ~bud joins the group and invites ~nec. ~nec receives the invitation.
::  ~bud leaves the group, then ~nec receives a revoked invitation.
::
++  ph-test-group-invite-revoke-inviter-leave
  =/  m  (strand ,~)
  ^-  form:m
  ;<  ~  bind:m  (watch-app /~bud/groups/v1/groups [~bud %groups] /v1/groups)
  ;<  ~  bind:m  (watch-app /~bud/groups/v1/foreigns [~bud %groups] /v1/foreigns)
  ;<  ~  bind:m  (watch-app /~nec/groups/v1/foreigns [~nec %groups] /v1/foreigns)
  ::
  ;<  ~  bind:m  (create-test-group ~zod %private (my ~bud^(sy %admin ~) ~))
  ;<  *  bind:m  (wait-for-app-fact /~bud/groups/v1/foreigns [~bud %groups])
  ;<  ~  bind:m  (join-test-group ~bud ~zod)
  ;<  ~  bind:m  (ex-r-groups-fact-match-tag ~bud my-test-flag %create)
  =/  =a-groups:v8:gv  [%invite my-test-flag (sy ~nec ~) [~ ~]]
  ;<  ~  bind:m  (poke-app [~bud %groups] group-action-4+a-groups)
  ;<  ~  bind:m  (ex-foreign-invite-valid ~nec my-test-flag ~bud &)
  =/  =a-groups:v8:gv  [%leave my-test-flag]
  ;<  ~  bind:m  (poke-app [~bud %groups] group-action-4+a-groups)
  ;<  ~  bind:m  (ex-foreign-invite-valid ~nec my-test-flag ~bud |)
  (pure:m ~)
::  +ph-test-group-join-private: test private group joins with issued token
::
::  scenario
::
::  ~zod hosts a private group and sends an invitation to ~bud.
::  ~bud receives the invitation and joins the group successfully,
::  receiving the group creation fact.
::
++  ph-test-group-join-private
  =/  m  (strand ,~)
  ^-  form:m
  ;<  ~  bind:m  (watch-app /~bud/groups/v1/groups [~bud %groups] /v1/groups)
  ;<  ~  bind:m  (watch-app /~bud/groups/v1/foreigns [~bud %groups] /v1/foreigns)
  ::
  ;<  ~  bind:m  (create-test-group ~zod %private (my ~bud^~ ~))
  ;<  *  bind:m  (wait-for-app-fact /~bud/groups/v1/foreigns [~bud %groups])
  ;<  ~  bind:m  (join-test-group ~bud ~zod)
  ;<  ~  bind:m  (ex-r-groups-fact-match-tag ~bud ~zod^%my-test-group %create)
  (pure:m ~)
::  +ph-test-group-join-private-ask: test private group joins by ask request
::
::  scenario
::
::  ~zod hosts a private group.
::  ~bud asks to join the group, then ~zod approves the request.
::  ~bud joins the group successfully, receiving the group creation fact.
::
++  ph-test-group-join-private-ask
  =/  m  (strand ,~)
  ^-  form:m
  ;<  ~  bind:m  (watch-app /~zod/groups/v1/groups [~zod %groups] /v1/groups)
  ;<  ~  bind:m  (watch-app /~bud/groups/v1/groups [~bud %groups] /v1/groups)
  ::
  ::  ~zod hosts a private group.
  ::
  ;<  ~  bind:m  (create-test-group ~zod %private ~)
  ;<  ~  bind:m  (ex-r-groups-fact-match-tag ~zod ~zod^%my-test-group %create)
  ::  ~bud asks to join the group, then ~zod receives the ask update.
  ::
  =/  =a-foreigns:v8:gv
    [%foreign my-test-flag %ask ~]
  ;<  ~  bind:m  (poke-app [~bud %groups] group-foreign-2+a-foreigns)
  ;<  ~  bind:m  (ex-r-groups-fact-match-tag ~zod ~zod^%my-test-group %entry)
  ::  NOTE: protect against race condition
  ;<  ~  bind:m  (sleep ~s5)
  ::  ~zod approves the ask request, then ~bud joins the group.
  ::
  =/  =c-groups:g
    [%group my-test-flag [%entry %ask (sy ~bud ~) %approve]]
  ;<  ~  bind:m  (poke-app [~zod %groups] group-command+c-groups)
  ;<  ~  bind:m  (ex-r-groups-fact-match-tag ~bud ~zod^%my-test-group %create)
  (pure:m ~)
::  +ph-test-group-leave: test group leaves
::
::  scenario
::
::  ~zod hosts a group and sends an invitation to ~bud.
::  ~bud joins the group successfully, then leaves the group.
::  ~bud receives the group deletion fact.
::
++  ph-test-group-leave
  =/  m  (strand ,~)
  ^-  form:m
  ;<  ~  bind:m  (watch-app /~bud/groups/v1/groups [~bud %groups] /v1/groups)
  ;<  ~  bind:m  (watch-app /~bud/groups/v1/foreigns [~bud %groups] /v1/foreigns)
  ::
  ;<  ~  bind:m  (create-test-group ~zod %secret (my ~bud^~ ~))
  ;<  *  bind:m  (wait-for-app-fact /~bud/groups/v1/foreigns [~bud %groups])
  ;<  ~  bind:m  (join-test-group ~bud ~zod)
  ;<  ~  bind:m  (ex-r-groups-fact-match-tag ~bud ~zod^%my-test-group %create)
  ::  ~bud leaves the group, then receives the deletion fact.
  ::
  =/  =a-groups:v8:gv  [%leave my-test-flag]
  ;<  ~  bind:m  (poke-app [~bud %groups] group-action-4+a-groups)
  ;<  ~  bind:m  (ex-r-groups-fact-match-tag ~bud ~zod^%my-test-group %delete)
  (pure:m ~)
--

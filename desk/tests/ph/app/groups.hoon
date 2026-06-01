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
::  ~zod hosts a private group and invites ~bud as an admin.
::  ~bud joins the group, then invites ~nec as another member.
::  ~nec receives the invitation and joins the group successfully,
::  receiving the group creation fact.
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
  ;<  ~  bind:m  (join-test-group ~bud ~zod)
  ;<  ~  bind:m  (ex-r-groups-fact-match-tag ~bud ~zod^%my-test-group %create)
  =/  =a-groups:v8:gv
    [%invite my-test-flag (sy ~nec ~) [~ ~]]
  ;<  ~  bind:m  (poke-app [~bud %groups] group-action-4+a-groups)
  ;<  *  bind:m  (wait-for-app-fact /~nec/groups/v1/foreigns [~nec %groups])
  ;<  ~  bind:m  (join-test-group ~nec ~zod)
  ;<  ~  bind:m  (ex-r-groups-fact-match-tag ~nec ~zod^%my-test-group %create)
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

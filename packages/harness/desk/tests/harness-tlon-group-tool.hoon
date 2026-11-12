/-  g=groups-ver
/+  *test, policy=harness-tlon-group-policy, tool=harness-tlon-group-tool
|%
++  fixture
  ^-  group:v9:g
  =/  group  *group:v9:g
  =.  roles.group
    %-  my
    :~  [%admin `role:v9:g`[['Admin' '' '' ''] ~]]  [%steward `role:v9:g`[['Steward' '' '' ''] ~]]
        [%editors `role:v9:g`[['Editors' 'Keep' 'image' 'cover'] ~]]
    ==
  =.  admins.group  (silt `(list @tas)`~[%admin %steward])
  group(seats (my ~[[~nec `seat:v9:g`[(silt `(list @tas)`~[%editors %admin %steward]) ~2026.9.9]]]))
++  native-request
  |=  [args=json our=@p available=?]
  ^-  (unit [body=@t effect=(unit noun)])
  =/  =bowl:gall  *bowl:gall
  =.  bowl  bowl(our our, src our, now ~2026.10.1)
  =/  group  fixture
  =.  pending.admissions.group  (my ~[[~zod (silt `(list @tas)`~[%editors])]])
  =.  requests.admissions.group  (my ~[[~bus [~2026.10.1 ~]]])
  =.  invited.admissions.group  (my ~[[~nus [~2026.10.1 `0v123]]])
  =/  foreign  *foreign:v8:g
  =.  foreign  foreign(token `0v456)
  =/  attempt  |.((run:~(. tool bowl) args /fixture/1))
  =/  checked
    %+  mink  [attempt %9 2 %0 1]
    |=  [ref=* raw=*]
    ^-  (unit (unit noun))
    =/  path  ;;(path raw)
    ?:  =(%$ (rear path))  ``available
    ?:  (lien path |=(part=@ta =(%foreigns part)))
      ``(my ~[[[~bus %remote] foreign]])
    ?:  (lien path |=(part=@ta =(%groups part)))
      ``(my ~[[[~lux %test] group]])
    ~
  ?.  ?=(%0 -.checked)  ~
  ::  Preserve embedded vase types as data; only inspect the returned envelope.
  `;;([body=@t effect=(unit noun)] product.checked)
++  field
  |=  [value=json key=@t]
  ^-  json
  ?>  ?=(%o -.value)
  (~(got by p.value) key)
++  test-native-role-directory-keeps-admin-status-and-has-no-effect
  =/  args  (need (de:json:html '{"action":"list_roles","group":"~lux/test"}'))
  =/  result  (need (native-request args ~bus &))
  =/  body  (need (de:json:html body.result))
  =/  items  (field body 'items')
  ?>  ?=(%a -.items)
  =/  admins  (skim p.items |=(row=json =([%b &] (field row 'admin'))))
  ;:  weld
      (expect-eq !>(~) !>(effect.result))
      (expect-eq !>(3) !>((lent p.items)))
      (expect-eq !>(2) !>((lent admins)))
      (expect-eq !>([%b |]) !>((field body 'has_more')))
  ==
++  test-native-request-directory-projects-only-ships
  =/  args
    (need (de:json:html '{"action":"list_group_requests","group":"~lux/test"}'))
  =/  result  (need (native-request args ~lux &))
  =/  expected
    %-  pairs:enjs:format
    :~  ['pending' %a ~[[%s '~zod']]]
        ['requests' %a ~[[%s '~bus']]]
        ['invited' %a ~[[%s '~nus']]]
        ['has_more' %b |]
        ['next_offset' ~]
    ==
  ;:  weld
      (expect-eq !>(~) !>(effect.result))
      (expect-eq !>(expected) !>((need (de:json:html body.result))))
  ==
++  test-native-invite-directory-does-not-expose-tokens
  =/  args  (need (de:json:html '{"action":"list_group_invites"}'))
  =/  result  (need (native-request args ~lux &))
  =/  item
    %-  pairs:enjs:format
    :~  ['group' %s '~bus/remote']
        ['title' %s '']
        ['has_invite' %b |]
        ['progress' ~]
    ==
  =/  expected
    %-  pairs:enjs:format
    ~[['items' %a ~[item]] ['has_more' %b |] ['next_offset' ~]]
  ;:  weld
      (expect-eq !>(~) !>(effect.result))
      (expect-eq !>(expected) !>((need (de:json:html body.result))))
  ==
++  test-native-availability-and-request-admin-checks-reject
  =/  roles  (need (de:json:html '{"action":"list_roles","group":"~lux/test"}'))
  =/  requests
    (need (de:json:html '{"action":"list_group_requests","group":"~lux/test"}'))
  ;:  weld
      (expect-eq !>(~) !>((native-request roles ~lux |)))
      (expect-eq !>(~) !>((native-request requests ~bus &)))
  ==
++  test-native-invite-request-keeps-wire-and-target
  =/  args
    (need (de:json:html '{"action":"request_group_invite","group":"~bus/remote"}'))
  =/  result  (need (native-request args ~lux &))
  =/  emitted
    ;;  $:  %pass  wire=wire  %agent  target=[@p @tas]  %poke
            mark=@tas  payload=[type=* value=*]
        ==
    (need effect.result)
  %-  expect-eq
  :-  !>([/fixture/1 [~lux %groups] %group-knock [~bus %remote]])
  !>([wire.emitted target.emitted mark.emitted value.payload.emitted])
++  test-role-name-is-not-authority
  =/  group  fixture
  =.  admins.group  ~
  (expect !>(&(!(admin:policy ~nec ~lux group) (admin:policy ~lux ~lux group))))
++  test-create-seeds-owner-admin-in-one-command
  =/  args  (pairs:enjs:format ~[['name' %s 'test'] ['title' %s 'Test'] ['owner' %s '~nec']])
  =/  create  (create:policy args ~lux ~)
  %-  expect
  !>  ?&  =(%secret privacy.create)  =(1 ~(wyt by members.create))
          =(`(silt ~[%admin]) (~(get by members.create) ~nec))
      ==
++  test-create-refuses-existing-name
  =/  args  (pairs:enjs:format ~[['name' %s 'test'] ['title' %s 'Replacement']])
  =/  known  (my ~[[[~lux %test] fixture]])
  (expect-eq !>(~) !>((mole |.((create:policy args ~lux known)))))
++  test-promote-requires-an-actually-privileged-role
  =/  bad
    %-  pairs:enjs:format
    ~[['action' %s 'promote_member'] ['ship' %s '~nec'] ['role' %s 'editors']]
  =/  good
    %-  pairs:enjs:format
    ~[['action' %s 'promote_member'] ['ship' %s '~nec'] ['role' %s 'steward']]
  =/  expected=a-group:v8:g  [%seat (silt ~[~nec]) %add-roles (silt ~[%steward])]
  %-  expect
  !>  ?&  =(~ (mole |.((manage:policy bad ~lux [~lux %test] fixture))))
          =(expected (manage:policy good ~lux [~lux %test] fixture))
      ==
++  test-demote-removes-all-admin-roles-not-ordinary-roles
  =/  args  (pairs:enjs:format ~[['action' %s 'demote_member'] ['ship' %s '~nec']])
  =/  expected=a-group:v8:g
    [%seat (silt ~[~nec]) %del-roles (silt `(list @tas)`~[%admin %steward])]
  (expect-eq !>(expected) !>((manage:policy args ~lux [~lux %test] fixture)))
++  test-refuses-demoting-host
  =/  args  (pairs:enjs:format ~[['action' %s 'demote_member'] ['ship' %s '~nec']])
  (expect-eq !>(~) !>((mole |.((manage:policy args ~nec [~nec %test] fixture)))))
++  test-native-nonadmin-cannot-change-privacy
  =/  args  (pairs:enjs:format ~[['action' %s 'set_group_privacy'] ['privacy' %s 'public']])
  =/  group  fixture
  =.  admins.group  ~
  (expect-eq !>(~) !>((mole |.((manage:policy args ~nec [~lux %test] group)))))
++  test-update-role-preserves-unedited-metadata
  =/  args
    %-  pairs:enjs:format
    ~[['action' %s 'update_role'] ['role' %s 'editors'] ['title' %s 'Writers']]
  =/  expected=a-group:v8:g  [%role (silt ~[%editors]) %edit ['Writers' 'Keep' 'image' 'cover']]
  (expect-eq !>(expected) !>((manage:policy args ~lux [~lux %test] fixture)))
++  test-management-families-require-current-admin
  =/  actions=(list @t)
    :~  'delete_group'  'delete_role'  'delete_channel'  'add_channel_readers'
        'remove_channel_readers'  'set_group_privacy'  'create_role'  'update_role'
        'kick_member'  'ban_member'  'unban_member'  'approve_join_request'
        'reject_join_request'  'revoke_group_invite'  'demote_member'  'promote_member'
        'assign_role'  'remove_role'
    ==
  =/  denied
    %+  levy  actions
    |=  action=@t
    =/  args  (pairs:enjs:format ~[['action' %s action]])
    =(~ (mole |.((manage:policy args ~bud [~lux %test] fixture))))
  (expect !>(denied))
++  test-channel-reader-changes-preserve-the-native-target-and-role
  =/  group  fixture
  =.  channels.group  (my ~[[[%chat ~lux %general] *channel:v9:g]])
  =/  fields=(list [@t json])
    ~[['channel' %s 'chat/~lux/general'] ['role' %s 'editors']]
  =/  add  (pairs:enjs:format [['action' %s 'add_channel_readers'] fields])
  =/  remove  (pairs:enjs:format [['action' %s 'remove_channel_readers'] fields])
  =/  added=a-group:v8:g  [%channel [%chat ~lux %general] %add-readers (silt ~[%editors])]
  =/  removed=a-group:v8:g  [%channel [%chat ~lux %general] %del-readers (silt ~[%editors])]
  ;:  weld
      (expect-eq !>(added) !>((manage:policy add ~lux [~lux %test] group)))
      (expect-eq !>(removed) !>((manage:policy remove ~lux [~lux %test] group)))
      (expect-eq !>(~) !>((mole |.((manage:policy add ~lux [~lux %test] fixture)))))
  ==
++  test-channel-deletion-requires-the-exact-confirmation
  =/  group  fixture
  =.  channels.group  (my ~[[[%chat ~lux %general] *channel:v9:g]])
  =/  fields=(list [@t json])
    ~[['action' %s 'delete_channel'] ['channel' %s 'chat/~lux/general']]
  =/  good  (pairs:enjs:format [['confirm' %s 'chat/~lux/general'] fields])
  =/  bad  (pairs:enjs:format [['confirm' %s 'chat/~lux/other'] fields])
  =/  expected=a-group:v8:g  [%channel [%chat ~lux %general] %del ~]
  ;:  weld
      (expect-eq !>(expected) !>((manage:policy good ~lux [~lux %test] group)))
      (expect-eq !>(~) !>((mole |.((manage:policy bad ~lux [~lux %test] group)))))
  ==
++  test-rejects-unknown-member-and-join-request
  =/  role
    %-  pairs:enjs:format
    ~[['action' %s 'assign_role'] ['role' %s 'editors'] ['ship' %s '~bud']]
  =/  join  (pairs:enjs:format ~[['action' %s 'approve_join_request'] ['ship' %s '~bud']])
  =/  okay
    ?&  =(~ (mole |.((manage:policy role ~lux [~lux %test] fixture))))
        =(~ (mole |.((manage:policy join ~lux [~lux %test] fixture))))
    ==
  (expect !>(okay))
--

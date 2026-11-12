::  Native directory reads through the tool dispatcher, with synthetic scries.
/-  g=groups-ver, d=channels-ver, ct=contacts
/+  *test, operations=harness-tlon-operations
|%
++  group
  ^-  group:v9:g
  =/  group  *group:v9:g
  =.  meta.group  ['Fixture' 'Description' '' '']
  =.  seats.group
    (my ~[[~nec `seat:v9:g`[(silt `(list @tas)`~[%editors]) ~2026.9.9]]])
  =/  channel  *channel:v9:g
  =.  channel  channel(meta ['Chat' '' '' ''], readers (silt `(list @tas)`~[%editors]))
  %=  group  channels
      (my ~[[[%chat ~lux %test] channel] [[%notes ~lux %book] channel(meta ['Notes' '' '' ''])]])
  ==
::
++  read
  |=  args=json
  ^-  json
  =/  =bowl:gall  *bowl:gall
  =.  bowl  bowl(our ~lux, src ~lux, now ~2026.10.1)
  =/  leaf  *leaf:ct
  =.  con.leaf  (my ~[[%nickname [%text 'Remote']] [%bio [%text 'Description']]])
  =.  mod.leaf  (my ~[[%nickname [%text 'Local']] [%status [%text 'Local status']]])
  =/  permissions  *perm:v9:d
  =.  writers.permissions  (silt `(list @tas)`~[%writers])
  =/  attempt
    |.
    =/  result  (run:~(. operations bowl) args /fixture/1 now.bowl)
    ?>  ?=(~ effect.result)
    (need (de:json:html body.result))
  =/  checked
    %+  mink  [attempt %9 2 %0 1]
    |=  [ref=* raw=*]
    ^-  (unit (unit noun))
    =/  path  ;;(path raw)
    ?:  =(%$ (rear path))  ``&
    ?:  (lien path |=(part=@ta =(%groups part)))
      ``(my ~[[[~lux %test] group]])
    ?:  =(%channel-perm (rear path))  ``permissions
    ?:  =(%contact-directory-0 (rear path))  ``(my ~[[~nec leaf]])
    ?:  =(%contact-1 (rear path))  ``(my ~[[%nickname [%text 'Self']]])
    ~
  ?>  ?=(%0 -.checked)
  ;;(json product.checked)
::
++  field
  |=  [value=json key=@t]
  ^-  json
  ?>  ?=(%o -.value)
  (~(got by p.value) key)
::
++  test-group-citation-and-directory-reads-have-no-effects
  =/  direct  (read (need (de:json:html '{"action":"get_group","group":"~lux/test"}')))
  =/  citation
    %-  read
    %-  need
    (de:json:html '{"action":"resolve_citation","citation":"/1/group/~lux/test"}')
  =/  members  (read (need (de:json:html '{"action":"list_members","group":"~lux/test"}')))
  =/  groups  (read (need (de:json:html '{"action":"list_groups"}')))
  =/  seats  (field members 'items')
  ?>  ?=([%a [* ~]] seats)
  ;:  weld
      (expect-eq !>(direct) !>(citation))
      (expect-eq !>([%s 'Fixture']) !>((field direct 'title')))
      (expect-eq !>([%n '1']) !>((field direct 'member_count')))
      (expect-eq !>([%s '~nec']) !>((field i.p.seats 'ship')))
      (expect-eq !>([%a ~[[%s 'editors']]]) !>((field i.p.seats 'roles')))
      (expect-eq !>([%b |]) !>((field groups 'has_more')))
  ==
::
++  test-notes-readers-do-not-imply-channel-writer-roles
  =/  chat
    %-  read
    %-  need
    %-  de:json:html
    '{"action":"get_channel_permissions","group":"~lux/test","channel":"chat/~lux/test"}'
  =/  notes
    %-  read
    %-  need
    %-  de:json:html
    '{"action":"get_channel_permissions","group":"~lux/test","channel":"notes/~lux/book"}'
  ;:  weld
      (expect-eq !>([%a ~[[%s 'editors']]]) !>((field chat 'readers')))
      (expect-eq !>([%a ~[[%s 'writers']]]) !>((field chat 'writers')))
      (expect-eq !>((field chat 'readers')) !>((field notes 'readers')))
      (expect-eq !>(~) !>((field notes 'writers')))
  ==
::
++  test-profile-read-retains-contact-merge-precedence
  =/  self  (read (need (de:json:html '{"action":"get_profile"}')))
  =/  peer  (read (need (de:json:html '{"action":"get_profile","ship":"~nec"}')))
  ;:  weld
      (expect-eq !>([%s 'Self']) !>((field (field self 'profile') 'nickname')))
      (expect-eq !>([%s 'Remote']) !>((field (field peer 'profile') 'nickname')))
      (expect-eq !>([%s 'Description']) !>((field (field peer 'profile') 'bio')))
      (expect-eq !>([%s 'Local status']) !>((field (field peer 'profile') 'status')))
  ==
--

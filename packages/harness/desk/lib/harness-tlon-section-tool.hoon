::  Group sections: the headings that arrange a group's channels. Each
::  action is one native command. %navigation creates a section and sets
::  the section order together; moving a channel to another section appends
::  it to that section.
/-  g=groups-ver
/+  spec=harness-tlon-tool, group-tool=harness-tlon-group-tool,
    policy=harness-tlon-group-policy
|_  bowl=bowl:gall
+$  result  [body=@t effect=(unit card:agent:gall)]
::
++  handles
  |=  action=@t
  =/  actions=(list @t)
    :~  'list_sections'  'create_section'  'rename_section'  'delete_section'
        'move_channel'  'order_sections'
    ==
  (lien actions |=(value=@t =(value action)))
::
++  run
  |=  [args=json wire=wire]
  ^-  result
  =/  action  (required:spec args 'action' 32)
  ?>  (handles action)
  =/  flag  (flag:spec (required:spec args 'group' 256))
  =/  group  (~(get by groups:~(. group-tool bowl)) flag)
  ?~  group  ['error: this ship is not in that group; use list_groups' ~]
  ?:  =('list_sections' action)  [(en:json:html (sections u.group)) ~]
  ?.  (admin:policy our.bowl -.flag u.group)
    ['error: arranging sections needs the group host or an admin; this ship is neither' ~]
  =/  change  (command args action u.group)
  ?:  ?=(%| -.change)  [(cat 3 'error: ' p.change) ~]
  :-  (rap 3 'accepted: local Tlon acknowledged ' action '; verify with list_sections' ~)
  :-  ~
  :*  %pass  wire  %agent  [our.bowl %groups]  %poke  %group-action-4
      !>(`a-groups:v8:g`[%group flag p.change])
  ==
::
++  command
  |=  [args=json action=@t group=group:v9:g]
  ^-  (each a-group:v8:g @t)
  ?:  =('create_section' action)
    =/  id  (mint group)
    =/  =section:v8:g  [[(required:spec args 'title' 128) '' '' ''] ~]
    [%& %navigation (my ~[[id section]]) (snoc section-order.group id)]
  ?:  =('order_sections' action)
    =/  order  (ids (required:spec args 'order' 4.096))
    ::  The host drops a section missing from the order.
    ?.  ?&  =((lent order) (lent section-order.group))
            =((silt order) (silt section-order.group))
        ==
      [%| 'order must list every section ID from list_sections exactly once']
    [%& %navigation ~ order]
  =/  id  (slug:spec (required:spec args 'section' 64))
  =/  section  (~(get by sections.group) id)
  ?~  section  [%| 'no section with that ID; use list_sections']
  ?:  =('rename_section' action)
    [%& %section id %edit meta.u.section(title (required:spec args 'title' 128))]
  ?:  =('delete_section' action)
    ?:  =(%default id)  [%| 'the default section cannot be deleted']
    ::  Deleting relabels its channels without listing them anywhere.
    ?:  (lien ~(val by channels.group) |=(channel=channel:v9:g =(id section.channel)))
      [%| 'move the section\'s channels to another section with move_channel first']
    [%& %section id %del ~]
  ?>  =('move_channel' action)
  =/  nest  (group-nest:spec (required:spec args 'channel' 256))
  =/  channel  (~(get by channels.group) nest)
  ?~  channel  [%| 'no channel with that ID in the group; use list_channels']
  ?.  =(id section.u.channel)  [%& %channel nest %section id]
  ?.  (has:spec args 'index')
    [%| 'that channel is already in that section; give index to reorder it']
  =/  index  (number:spec args 'index' 0)
  ?.  (lth index (lent order.u.section))  [%| 'index is past the end of the section']
  [%& %section id %move-nest nest index]
::
::  +mint: a fresh section ID, shaped as the app makes them
::
++  mint
  |=  group=group:v9:g
  ^-  @tas
  =/  text  (scot %uv eny.bowl)
  =/  id  (cat 3 'z' (rsh [3 (sub (met 3 text) 5)] text))
  ?<  (~(has by sections.group) id)
  id
::
++  ids
  |=  raw=@t
  ^-  (list @tas)
  =/  parsed  (need (de:json:html raw))
  ?>  ?=(%a -.parsed)
  %+  turn  p.parsed
  |=  item=json
  ?>  ?=(%s -.item)
  (slug:spec p.item)
::
++  sections
  |=  group=group:v9:g
  ^-  json
  =/  channel-id
    |=  nest=[kind=@tas ship=@p name=@tas]
    (rap 3 kind.nest '/' (scot %p ship.nest) '/' name.nest ~)
  :-  %a
  %+  turn  section-order.group
  |=  id=@tas
  =/  section  (~(gut by sections.group) id *section:v8:g)
  %-  pairs:enjs:format
  :~  ['section' %s id]
      ['title' %s title.meta.section]
      ['channels' %a (turn order.section |=(nest=nest:v8:g [%s (channel-id nest)]))]
  ==
--

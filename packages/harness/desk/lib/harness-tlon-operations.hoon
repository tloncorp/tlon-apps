::  Ship-wide Tlon operations. The adapter owns live grants and receipts;
::  this core reads public native state and builds one effect per invocation.
/-  t=harness-tlon, g=groups-ver, d=channels-ver,
    ct=contacts, meta
/-  cite
/+  spec=harness-tlon-tool, io=harness-tlon-io,
    conversation=harness-tlon-conversation-tool, contact=harness-tlon-contact-tool,
    group-tool=harness-tlon-group-tool, policy=harness-tlon-group-policy,
    message=harness-tlon-message-tool
/+  notes=harness-tlon-notes-tool, inbox=harness-tlon-inbox-tool, club=harness-tlon-club-tool
/+  hooks=harness-tlon-hook-tool, publishing=harness-tlon-publish-tool,
    activity=harness-tlon-activity-tool, channel=harness-tlon-channel-tool,
    section=harness-tlon-section-tool, attachment=harness-tlon-attachment,
    search=harness-tlon-search-tool, invite=harness-tlon-invite-tool,
    bucket=harness-tlon-bucket-tool
/+  migration=harness-tlon-notes-migration, paths=harness-tlon-paths, ht=harness-tools
|_  bowl=bowl:gall
+*  read-path  ~(. paths [our now]:bowl)
::
++  groups
  ^-  groups:v9:g
  ?>  .^(? %gu /(scot %p our.bowl)/groups/(scot %da now.bowl)/$)
  .^(groups:v9:g %gx /(scot %p our.bowl)/groups/(scot %da now.bowl)/v2/groups/noun)
::
++  group-id
  |=  flag=[@p @tas]
  (rap 3 (scot %p -.flag) '/' +.flag ~)
::
++  channel-id
  |=  nest=[@tas @p @tas]
  (rap 3 -.nest '/' (group-id +.nest) ~)
::
++  metadata
  |=  [args=json old=data:meta]
  ^-  data:meta
  ?>  (lien `(list @t)`~['title' 'description' 'image' 'cover'] |=(key=@t (has:spec args key)))
  =/  title  (string:spec args 'title' title.old 128)
  ?>  !=('' title)
  ::  Image and cover are a URL or a color, as the app stores them. Empty
  ::  keeps the current value: models fill unused arguments with ''.
  =/  kept
    |=  [key=@t current=@t]
    =/  value  (string:spec args key current 2.048)
    ?:(=('' value) current value)
  :^  title
    (string:spec args 'description' description.old 1.024)
    (kept 'image' image.old)
  (kept 'cover' cover.old)
::
++  channel-permissions
  |=  args=json
  ^-  json
  =/  flag  (flag:spec (required:spec args 'group' 256))
  =/  group  (~(got by groups) flag)
  =/  nest  (group-nest:spec (required:spec args 'channel' 256))
  =/  channel  (~(got by channels.group) nest)
  ?:  =(%notes kind.nest)
    %-  pairs:enjs:format
    :~  ['readers' %a (turn ~(tap in readers.channel) |=(role=@tas [%s role]))]
        ['writers' ~]
        :*  'note'  %s
            'Notes does not have channel writer roles. Native owner/editor membership plus current group read access gates editing; use list_notebook_members.'
        ==
    ==
  =/  =perm:v9:d
    .^(perm:v9:d %gx (channel-permissions:read-path nest))
  =/  roles
    |=  values=(set @tas)
    :-  %a
    %+  turn  ~(tap in values)
    |=  role=@tas
    [%s role]
  %-  pairs:enjs:format
  :~  ['readers' (roles readers.channel)]
      ['writers' (roles writers.perm)]
      ['empty_means_all_members' %b &]
  ==
::
++  profile
  |=  args=json
  ^-  json
  ?>  .^(? %gu /(scot %p our.bowl)/contacts/(scot %da now.bowl)/$)
  =/  who  (ship:spec (string:spec args 'ship' (scot %p our.bowl) 128))
  =/  details=contact:ct
    ?:  =(who our.bowl)
      .^(contact:ct %gx /(scot %p our.bowl)/contacts/(scot %da now.bowl)/v1/self/contact-1)
    =/  =directory:ct
      .^  directory:ct  %gx
        /(scot %p our.bowl)/contacts/(scot %da now.bowl)/v1/directory/contact-directory-0
      ==
    =/  leaf  (~(got by directory) who)
    (~(uni by mod.leaf) con.leaf)
  %-  pairs:enjs:format
  :~  ['ship' %s (scot %p who)]
      ['profile' (encode:contact details)]
  ==
::
++  group-directory
  |=  args=json
  ^-  json
  =/  rows  ~(tap by groups)
  =/  items
    %+  turn  rows
    |=  [flag=[@p @tas] group=group:v9:g]
    %-  pairs:enjs:format
    :~  ['group' %s (group-id flag)]
        ['title' %s title.meta.group]
        ['privacy' %s privacy.admissions.group]
    ==
  (directory:spec args items)
::
++  channel-directory
  |=  args=json
  ^-  json
  %+  directory:spec  args
  %-  zing
  %+  turn  ~(tap by groups)
  |=  [flag=[@p @tas] group=group:v9:g]
  %+  turn  ~(tap by channels.group)
  |=  [nest=[@tas @p @tas] channel=channel:v9:g]
  %-  pairs:enjs:format
  :~  ['channel' %s (channel-id nest)]
      ['title' %s title.meta.channel]
      ['group' %s (group-id flag)]
      ['group_title' %s title.meta.group]
  ==
::
++  group-details
  |=  [args=json action=@t]
  ^-  json
  ?:  &(=('list_channels' action) !(has:spec args 'group'))  (channel-directory args)
  =/  flag  (flag:spec (required:spec args 'group' 256))
  =/  group  (~(got by groups) flag)
  ?:  =('list_members' action)
    =/  rows  ~(tap by seats.group)
    =/  items
      %+  turn  rows
      |=  [who=@p seat=seat:v9:g]
      =/  admin  |(=(who -.flag) (gth ~(wyt in (~(int in roles.seat) admins.group)) 0))
      %-  pairs:enjs:format
      :~  ['ship' %s (scot %p who)]
          ['roles' %a (turn ~(tap in roles.seat) |=(role=@tas [%s role]))]
          ['admin' %b admin]
          ['joined' %s (scot %da joined.seat)]
      ==
    (directory:spec args items)
  =/  rows  ~(tap by channels.group)
  =/  items
    %+  turn  (scag 100 (slag (offset:spec args) rows))
    |=  [nest=[@tas @p @tas] channel=channel:v9:g]
    %-  pairs:enjs:format
    :~  ['channel' %s (channel-id nest)]
        ['title' %s title.meta.channel]
    ==
  =/  next-offset  (add (offset:spec args) 100)
  =/  more  (gth (lent rows) next-offset)
  %-  pairs:enjs:format
  :~  ['group' %s (group-id flag)]
      ['title' %s title.meta.group]
      ['description' %s description.meta.group]
      ['privacy' %s privacy.admissions.group]
      ['member_count' (numb:enjs:format ~(wyt by seats.group))]
      ['channels' %a items]
      ['has_more' %b more]
      ['next_offset' ?:(more [%s (scot %ud next-offset)] ~)]
  ==
::
++  citation-arguments
  |=  args=json
  ^-  json
  ::  Translate native references into the ordinary authorized read actions.
  =/  citation
    (parse:cite (need (rush (required:spec args 'citation' 1.024) stap)))
  ?:  ?=(%group -.citation)
    %-  pairs:enjs:format
    :~  ['action' %s 'get_group']
        ['group' %s (group-id flag.citation)]
    ==
  ?>  ?=(%chan -.citation)
  ?>  ?=([@ @ *] wer.citation)
  =/  root  (slav %ud i.t.wer.citation)
  ?:  =(%notes p.nest.citation)
    %-  pairs:enjs:format
    :~  ['action' %s 'get_note']
        ['notebook' %s (group-id q.nest.citation)]
        ['note_id' %s (scot %ud root)]
        ['offset' %s (scot %ud (offset:spec args))]
    ==
  ?>  ?=(?(%msg %note %curio) i.wer.citation)
  =/  target  (channel-id nest.citation)
  =/  rest  t.t.wer.citation
  =/  fields=(list [@t json])
    :~  ['action' %s 'get_message']
        ['channel' %s target]
        ['offset' %s (scot %ud (offset:spec args))]
    ==
  ?~  rest
    (pairs:enjs:format (snoc fields ['message_id' %s (scot %da root)]))
  ?>  ?=([@ ~] rest)
  =/  reply-fields=(list [@t json])
    :~  ['parent' %s (scot %da root)]
        ['message_id' %s (scot %da (slav %ud i.rest))]
    ==
  (pairs:enjs:format (weld fields reply-fields))
::
++  run
  |=  [args=json wire=wire sent=@da]
  ^-  [body=@t effect=(unit card:agent:gall)]
  =/  action  (required:spec args 'action' 32)
  ?:  =('help' action)  [(help:spec (string:spec args 'topic' '' 32)) ~]
  ?:  (handles:~(. migration bowl) action)  (run:~(. migration bowl) args wire)
  ::  Notes channels use notebook lifecycle operations.
  ?:  &(=('delete_channel' action) =('notes/' (end [3 6] (string:spec args 'channel' '' 256))))
    =/  nest  (group-nest:spec (required:spec args 'channel' 256))
    =/  flag  (flag:spec (required:spec args 'group' 256))
    =/  group  (~(got by groups) flag)
    ?>  &((admin:policy our.bowl -.flag group) (~(has by channels.group) nest))
    ?>  =((required:spec args 'channel' 256) (required:spec args 'confirm' 256))
    =/  notebook  (group-id +.nest)
    =/  request
      %-  pairs:enjs:format
      :~  ['action' %s 'delete_notebook']
          ['notebook' %s notebook]
          ['confirm' %s notebook]
      ==
    (run:~(. notes bowl) request wire)
  ?:  &(=('create_channel' action) =('notes' (string:spec args 'kind' '' 16)))
    ?:  |((has:spec args 'name') !=('' (string:spec args 'description' '' 1.024)))
      :*
        'error: native Notes assigns its own notebook/channel name; omit name and description, then use update_channel for description'
        ~
      ==
    ?>  (has:spec args 'group')
    ?>  ?=(%o -.args)
    (run:~(. notes bowl) [%o (~(put by p.args) 'action' [%s 'create_notebook'])] wire)
  ?:  (handles:~(. hooks bowl) action)
    ?>  ?=([@ @ ~] wire)
    (run:~(. hooks bowl) args /tlon-hooks/[i.t.wire])
  ?:  (handles:~(. publishing bowl) action)  (run:~(. publishing bowl) args wire)
  ?:  &(=('edit_message' action) !(has:spec args 'channel'))
    ['error: native Tlon supports editing channel posts and replies, not DM or group-DM messages' ~]
  ?:  =('get_message' action)  [(en:json:html (read:~(. message bowl) args)) ~]
  ?:  =('history_around' action)  [(en:json:html (around:~(. message bowl) args)) ~]
  ?:  =('resolve_citation' action)  $(args (citation-arguments args))
  ?:  (handles:~(. notes bowl) action)  (run:~(. notes bowl) args wire)
  ?:  =('activity_inbox' action)  [(en:json:html (read:~(. inbox bowl) args)) ~]
  ?:  (handles:~(. activity bowl) action)  (run:~(. activity bowl) args wire)
  ?:  (handles:~(. channel bowl) action)  (run:~(. channel bowl) args wire sent)
  ?:  (handles:~(. section bowl) action)  (run:~(. section bowl) args wire)
  ?:  (handles:~(. invite bowl) action)  (run:~(. invite bowl) args wire)
  ?:  (handles:~(. bucket bowl) action)  (run:~(. bucket bowl) args wire)
  ?:  (handles:~(. club bowl) action)  (run:~(. club bowl) args wire sent)
  ?:  (handles:~(. group-tool bowl) action)
    (run:~(. group-tool bowl) args wire)
  ?:  =('get_channel_permissions' action)
    [(en:json:html (channel-permissions args)) ~]
  ?:  =('list_dms' action)  [(en:json:html (dms:~(. conversation bowl) args)) ~]
  ?:  &(=('search_history' action) !(has:spec args 'ship') !(has:spec args 'channel'))
    [(en:json:html (run:~(. search bowl) args)) ~]
  ?:  |(=('history' action) =('search_history' action))
    [(en:json:html (history:~(. conversation bowl) args =('search_history' action))) ~]
  ?:  =('get_profile' action)  [(en:json:html (profile args)) ~]
  ?:  =('list_contacts' action)
    ?>  .^(? %gu /(scot %p our.bowl)/contacts/(scot %da now.bowl)/$)
    =/  result  contacts:~(. io bowl)
    ?>  ?=(%a -.result)
    [(en:json:html (directory:spec args p.result)) ~]
  ?:  =('list_groups' action)  [(en:json:html (group-directory args)) ~]
  ?:  |(=('get_group' action) =('list_channels' action) =('list_members' action))
    [(en:json:html (group-details args action)) ~]
  =/  refusal=(unit @t)
    ?.  |(=('send_dm' action) =('send_channel' action))  ~
    =/  composed  (compose:attachment args (destination:spec args))
    ?:(?=(%| -.composed) `p.composed ~)
  ?^  refusal  [(cat 3 'error: ' u.refusal) ~]
  ::  Mutations build one native card; the adapter observes its receipt.
  =/  =card:agent:gall  (mutation args wire sent action)
  [(receipt args action) `card]
::
::  +receipt: a mutation's acknowledgement. Posts sent together differ only
::  in their last id digits, so a reaction quotes the post it landed on: the
::  model can see when a copied id named the wrong one.
++  receipt
  |=  [args=json action=@t]
  ^-  @t
  =/  body
    %-  rap
    :-  3
    :~  'accepted: local Tlon acknowledged '
        action
        '; remote delivery or completion is not confirmed'
    ==
  ?.  =('react' action)  body
  =/  target  text:(get:~(. message bowl) args)
  (rap 3 body '. The post reacted to reads: ' (clip:ht target 200) ~)
::
++  mutation
  |=  [args=json wire=wire sent=@da action=@t]
  ^-  card:agent:gall
  ?:  |(=('edit_message' action) =('delete_message' action))
    (change:~(. message bowl) args wire)
  ?:  |(=('accept_dm' action) =('decline_dm' action))
    =/  who  (ship:spec (required:spec args 'ship' 128))
    =/  invited=(set @p)
      .^((set @p) %gx /(scot %p our.bowl)/chat/(scot %da now.bowl)/dm/invited/ships)
    ?>  (~(has in invited) who)
    [%pass wire %agent [our.bowl %chat] %poke %chat-dm-rsvp !>([who =('accept_dm' action)])]
  ?:  |(=('add_channel_writers' action) =('remove_channel_writers' action))
    =/  flag  (flag:spec (required:spec args 'group' 256))
    =/  group  (~(got by groups) flag)
    ?>  (admin:policy our.bowl -.flag group)
    =/  nest  (nest:spec (required:spec args 'channel' 256))
    ?>  (~(has by channels.group) nest)
    =/  role  (slug:spec (required:spec args 'role' 64))
    ?>  (~(has by roles.group) role)
    =/  act=a-channels:v10:d
      ?:  =('add_channel_writers' action)  [%channel nest %add-writers (silt ~[role])]
      [%channel nest %del-writers (silt ~[role])]
    [%pass wire %agent [our.bowl %channels] %poke %channel-action-2 !>(act)]
  ?:  =('update_profile' action)
    (edit-profile:~(. io bowl) wire (decode:contact args))
  ?:  |(=('add_contact' action) =('remove_contact' action) =('refresh_contact' action))
    =/  who  (ship:spec (required:spec args 'ship' 128))
    =/  act=action:ct
      ?:  =('add_contact' action)  [%page who ~]
      ::  Refreshing subscribes to the peer's profile without adding a contact.
      ?:  =('refresh_contact' action)  [%meet ~[who]]
      [%wipe ~[who]]
    [%pass wire %agent [our.bowl %contacts] %poke %contact-action-1 !>(act)]
  ?:  |(=('react' action) =('unreact' action))
    =/  to  (destination:spec args)
    ?>  (available:~(. conversation bowl) to)
    =/  emoji=(unit @t)
      ?:  =('unreact' action)  ~
      `(required:spec args 'emoji' 64)
    (reaction:~(. io bowl) wire to (required:spec args 'message_id' 256) emoji)
  ?:  |(=('send_dm' action) =('send_channel' action))
    =/  to  (destination:spec args)
    ?>  =(=('send_dm' action) ?=(%dm -.to))
    =/  composed  (compose:attachment args to)
    ?>  ?=(%& -.composed)
    =/  [content=story:v9:d meta=(unit data:meta) blob=(unit @t)]  p.composed
    (publish-story:~(. io bowl) wire to content sent meta blob)
  (group-mutation args wire action)
::
++  group-mutation
  |=  [args=json wire=wire action=@t]
  ^-  card:agent:gall
  =/  flag  (flag:spec (required:spec args 'group' 256))
  ?:  |(=('update_group' action) =('update_channel' action))
    =/  group  (~(got by groups) flag)
    =/  act=a-group:v8:g
      ?:  =('update_group' action)  [%meta (metadata args meta.group)]
      =/  nest  (group-nest:spec (required:spec args 'channel' 256))
      =/  channel  (~(got by channels.group) nest)
      [%channel nest %edit channel(meta (metadata args meta.channel))]
    :*  %pass  wire  %agent  [our.bowl %groups]  %poke  %group-action-4
        !>(`a-groups:v8:g`[%group flag act])
    ==
  ?:  =('invite_to_group' action)
    =/  who  (ship:spec (required:spec args 'ship' 128))
    :*  %pass  wire  %agent  [our.bowl %groups]  %poke  %group-action-4
        !>(`a-groups:v8:g`[%invite flag (silt ~[who]) ~ ~])
    ==
  ?:  =('join_group' action)
    [%pass wire %agent [our.bowl %groups] %poke %group-join !>([flag &])]
  ?:  =('leave_group' action)
    [%pass wire %agent [our.bowl %groups] %poke %group-leave !>(flag)]
  ?>  =('create_channel' action)
  =/  kind  (string:spec args 'kind' 'chat' 16)
  ?>  ?=(?(%chat %diary %heap) kind)
  =/  create=create-channel:v10:d
    :*  kind  (slug:spec (required:spec args 'name' 64))  flag
        (required:spec args 'title' 128)  (string:spec args 'description' '' 1.024)
        ~  ~  ~
    ==
  :*  %pass  wire  %agent  [our.bowl %channels]  %poke  %channel-action-2
      !>(`a-channels:v10:d`[%create create])
  ==
--

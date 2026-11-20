::  One channel's posts and membership: pins, forwards, and joining or
::  leaving the channel without leaving its group. A pin is the channel's
::  arranged order with the pinned post first, as the app writes it.
/-  t=harness-tlon, g=groups-ver, dv=channels-ver
/+  spec=harness-tlon-tool, io=harness-tlon-io, message=harness-tlon-message-tool,
    group-tool=harness-tlon-group-tool, policy=harness-tlon-group-policy,
    story=harness-tlon-story, ht=harness-tools
|_  bowl=bowl:gall
+$  result  [body=@t effect=(unit card:agent:gall)]
::
++  handles
  |=  action=@t
  =/  actions=(list @t)
    ~['pin_message' 'unpin_message' 'forward_message' 'join_channel' 'leave_channel']
  (lien actions |=(value=@t =(value action)))
::
++  channels
  ^-  channels:v10:dv
  .^(channels:v10:dv %gx /(scot %p our.bowl)/channels/(scot %da now.bowl)/v5/channels/noun)
::
++  run
  |=  [args=json wire=wire sent=@da]
  ^-  result
  =/  action  (required:spec args 'action' 32)
  ?>  (handles action)
  =/  nest  (nest:spec (required:spec args 'channel' 256))
  ?.  ?=(?(%chat %heap) kind.nest)
    ['error: use a chat or gallery (heap) channel; notebooks have their own actions' ~]
  ?:  =('join_channel' action)  (join nest wire)
  =/  joined  (~(get by channels) nest)
  ?~  joined
    ['error: this ship has not joined that channel; use join_channel first' ~]
  ?:  =('leave_channel' action)
    (accepted action [%channel nest %leave ~] wire)
  ?:  =('forward_message' action)  (forward args wire sent nest)
  (pin action args wire nest u.joined)
::
++  accepted
  |=  [action=@t act=a-channels:v10:dv wire=wire]
  ^-  result
  :-  (rap 3 'accepted: local Tlon acknowledged ' action '; remote completion is not confirmed' ~)
  `[%pass wire %agent [our.bowl %channels] %poke %channel-action-2 !>(act)]
::
++  join
  |=  [nest=[kind=?(%chat %heap) ship=@p name=@tas] wire=wire]
  ^-  result
  =/  hosts
    %+  murn  ~(tap by groups:~(. group-tool bowl))
    |=  [flag=[@p @tas] group=group:v9:g]
    ?.((~(has by channels.group) nest) ~ `flag)
  ?.  ?=([^ ~] hosts)
    ['error: no group this ship belongs to has that channel; join the group first' ~]
  (accepted 'join_channel' [%channel nest %join i.hosts] wire)
::
::  +posted: whether a top-level post or a reply exists and is not deleted
::
++  posted
  |=  [nest=[kind=@tas ship=@p name=@tas] parent=(unit @da) id=@da]
  ^-  ?
  =/  reader  ~(. message bowl)
  =/  found
    ?~  parent  (mule |.((channel-post:reader nest id)))
    (mule |.((channel-reply:reader nest u.parent id)))
  ?=(%& -.found)
::
++  pin
  |=  [action=@t args=json wire=wire nest=[kind=?(%chat %heap) ship=@p name=@tas] =channel:v10:dv]
  ^-  result
  =/  flag  group.perm.channel
  =/  group  (~(get by groups:~(. group-tool bowl)) flag)
  ::  The channel host enforces the same rule.
  ?.  ?|  =(our.bowl ship.nest)
          &(?=(^ group) (admin:policy our.bowl -.flag u.group))
      ==
    ['error: pinning needs the channel host or a group admin; this ship is neither' ~]
  =/  id  (timestamp:spec (required:spec args 'message_id' 128))
  ?.  (posted nest ~ id)
    :_  ~
    %+  rap  3
    :~  'error: no top-level post with that message_id in the channel; '
        'copy message_id exactly from history, and pin root posts, not replies'
    ==
  =/  order=(list @da)  (fall order.channel ~)
  =/  rest  (skip order |=(at=@da =(at id)))
  ?:  =('pin_message' action)
    ::  Quote the post pinned, as +receipt in harness-tlon-operations quotes a
    ::  reaction's: ids of posts sent together differ only in their last digits.
    =/  pinned  (accepted action [%channel nest %order `[id rest]] wire)
    =/  text  (story-to-text:story content:+:(channel-post:~(. message bowl) nest id))
    pinned(body (rap 3 body.pinned '. The pinned post reads: ' (clip:ht text 200) ~))
  ?:  =(rest order)  ['error: that post is not pinned in the channel' ~]
  (accepted action [%channel nest %order `rest] wire)
::
::  +forward: post a reference card to one post in another conversation.
::  The card carries no text of its own; readers see the quoted post.
::
++  forward
  |=  [args=json wire=wire sent=@da nest=[kind=?(%chat %heap) ship=@p name=@tas]]
  ^-  result
  =/  id  (timestamp:spec (required:spec args 'message_id' 128))
  =/  raw-parent  (string:spec args 'parent' '' 256)
  =/  parent=(unit @da)  ?:(=('' raw-parent) ~ `(timestamp:spec raw-parent))
  ?.  (posted nest parent id)
    :_  ~
    %+  rap  3
    :~  'error: no post with that message_id in the channel; copy message_id exactly from history, '
        'and for a thread reply give its root message_id as parent'
    ==
  =/  digits  |=(at=@da (crip (a-co:co at)))
  =/  where=path
    ?~  parent  /msg/(digits id)
    /msg/(digits u.parent)/(digits id)
  =/  target  (required:spec args 'to' 256)
  =/  to=destination:t
    ?:  =('~' (end 3 target))  [%dm (ship:spec target) ~]
    [%channel (nest:spec target) ~]
  ?:  ?&  ?=(%channel -.to)
          |(?=(%diary kind.nest.to) !(~(has by channels) nest.to))
      ==
    ['error: forward to a ~ship DM, or to a chat or gallery channel this ship has joined' ~]
  =/  reference=story:v9:dv  ~[[%block %cite %chan [kind.nest ship.nest name.nest] where]]
  :_  `(publish-story:~(. io bowl) wire to reference sent ~ ~)
  'accepted: local Tlon acknowledged forward_message; the post is a reference card to the original'
--

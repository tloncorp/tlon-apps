::  Exact native message reads and edits; preserve metadata and original identity.
/-  t=harness-tlon, cv=chat-ver, dv=channels-ver
/+  spec=harness-tlon-tool, hp=harness-tlon-history-page,
    hist=harness-tlon-history, story=harness-tlon-story,
    conversation=harness-tlon-conversation-tool, paths=harness-tlon-paths
|_  bowl=bowl:gall
+*  read-path  ~(. paths [our now]:bowl)
::
++  dm-post
  |=  [who=@p id=[@p @da]]
  ^-  writ:v7:cv
  =/  value=(may:v7:cv writ:v7:cv)
    .^  (may:v7:cv writ:v7:cv)  %gx
      (dm-post:read-path who id)
    ==
  ?>  ?=(%& -.value)
  +.value
::
++  dm-reply
  |=  [post=writ:v7:cv id=[@p @da]]
  ^-  reply:v7:cv
  =/  found=(list [at=@da value=(may:v7:cv reply:v7:cv)])
    %+  skim  (tap:on:dm-replies:hist replies.post)
    |=  [at=@da value=(may:v7:cv reply:v7:cv)]
    ?:(?=(%| -.value) | =(id id.+.value))
  ?~  found  !!
  ?>  ?=(%& -.value.i.found)
  +.value.i.found
::
++  channel-post
  |=  [nest=[kind=@tas ship=@p name=@tas] id=@da]
  ^-  post:v10:dv
  =/  page=paged-posts:v10:dv
    .^  paged-posts:v10:dv  %gx
      %+  weld  (channel-posts:read-path %v5 nest)
      /older/(scot %ud +(id))/1/outline/channel-posts-5
    ==
  =/  value  (get:on-posts:v10:dv posts.page id)
  ?>  ?=([~ %& *] value)
  +.u.value
::
++  channel-reply
  |=  [nest=[kind=@tas ship=@p name=@tas] parent=@da id=@da]
  ^-  reply:v10:dv
  =/  =replies:v10:dv
    .^  replies:v10:dv  %gx
      %+  weld  (channel-replies:read-path %v5 nest parent)
      /older/(scot %ud +(id))/1/channel-replies-5
    ==
  =/  value  (get:on-replies:v10:dv replies id)
  ?>  ?=([~ %& *] value)
  +.u.value
::
++  get
  |=  args=json
  ^-  message:hp
  =/  to  (destination:spec args)
  ?>  (available:~(. conversation bowl) to)
  =/  id  (required:spec args 'message_id' 256)
  ?-  -.to
      %dm
    =/  id  (dm-id:spec id)
    ?~  parent.to  (dm-post:hp (dm-post who.to id))
    (dm-reply:hp (dm-reply (dm-post who.to u.parent.to) id))
      %channel
    =/  id  (timestamp:spec id)
    ?~  parent.to
      =/  post  (channel-post nest.to id)
      (make-message:hp (scot %da id) author:+.+.post sent:+.+.post content:+.+.post)
    =/  reply  (channel-reply nest.to u.parent.to id)
    (make-message:hp (scot %da id) author:+.+.reply sent:+.+.reply content:+.+.reply)
  ==
::
++  read
  |=  args=json
  ^-  json
  (render args (get args))
::
++  render
  |=  [args=json message=message:hp]
  ^-  json
  =/  offset  (offset:spec args)
  =/  total  (met 3 text.message)
  ?>  (lte offset total)
  ::  Offsets returned here always land on a UTF-8 boundary.
  =/  rest  (rsh [3 offset] text.message)
  ?>  ?|  =('' rest)
          (lth (end [3 1] rest) 128)
          (gte (end [3 1] rest) 192)
      ==
  =/  chunk  (clip-text:hp rest 2.000)
  =/  next-offset  (add offset (met 3 chunk))
  %-  pairs:enjs:format
  :~  ['message_id' %s id.message]
      ['author' %s (scot %p author.message)]
      ['sent' %s (scot %da sent.message)]
      ['text' %s chunk]
      ['total_bytes' (numb:enjs:format total)]
      ['next_offset' ?:((lth next-offset total) [%s (scot %ud next-offset)] ~)]
  ==
::
++  around
  |=  args=json
  ^-  json
  =/  to  (destination:spec args)
  =/  focus  (get args)
  =/  rows=(list message:hp)
    ?-  -.to
        %dm
      =/  id  (dm-id:spec id.focus)
      =/  post  (dm-post who.to ?~(parent.to id u.parent.to))
      ?^  parent.to
        =/  reply  (dm-reply post id)
        =/  at  time.reply
        =/  rows
          %+  weld
            (bat:dm-replies:hist replies.post `+(at) 6)
          (tab:on:dm-replies:hist replies.post `at 5)
        %+  murn  rows
        |=  [at=@da value=(may:v7:cv reply:v7:cv)]
        ?:  ?=(%| -.value)  ~
        `(dm-reply:hp +.value)
      =/  page=paged-writs:v7:cv
        .^  paged-writs:v7:cv  %gx
          %+  weld  (dm-writs:read-path who.to)
          /around/(scot %ud time.post)/5/light/chat-paged-writs-4
        ==
      %+  murn  (tap:on:writs:v7:cv writs.page)
      |=  [at=@da value=(may:v7:cv writ:v7:cv)]
      ?:  ?=(%| -.value)  ~
      `(dm-post:hp +.value)
        %channel
      =/  id  (timestamp:spec id.focus)
      ?^  parent.to
        =/  prefix=path
          (channel-replies:read-path %v4 nest.to u.parent.to)
        =/  older=replies:v9:dv
          .^(replies:v9:dv %gx (weld prefix /older/(scot %ud +(id))/6/channel-replies-4))
        =/  newer=replies:v9:dv
          .^(replies:v9:dv %gx (weld prefix /newer/(scot %ud id)/5/channel-replies-4))
        =/  rows  (weld (tap:on-replies:v9:dv older) (tap:on-replies:v9:dv newer))
        %+  murn  rows
        |=  [at=@da value=(may:v9:dv reply:v9:dv)]
        ?:  ?=(%| -.value)  ~
        `(channel-reply:hp +.value)
      =/  page=paged-posts:v9:dv
        .^  paged-posts:v9:dv  %gx
          %+  weld  (channel-posts:read-path %v4 nest.to)
          /around/(scot %ud id)/5/outline/channel-posts-4
        ==
      %+  murn  (tap:on-posts:v9:dv posts.page)
      |=  [at=@da value=(may:v9:dv post:v9:dv)]
      ?:  ?=(%| -.value)  ~
      `(channel-post:hp +.value)
    ==
  ::  Shorter previews leave room for escaped text in eleven context rows.
  =/  rows
    %+  turn  rows
    |=  message=message:hp
    %*  .  message
      text  (clip-text:hp text.message 200)
      clipped  |(clipped.message (gth (met 3 text.message) 200))
    ==
  %-  pairs:enjs:format
  :~  ['focus' %s id.focus]
      ['messages' %a (turn rows message-json:hp)]
      ['context_each_side' %n '5']
  ==
::
++  change
  |=  [args=json wire=wire]
  ^-  card:agent:gall
  =/  action  (required:spec args 'action' 32)
  =/  delete  =('delete_message' action)
  =/  to  (destination:spec args)
  ?>  (available:~(. conversation bowl) to)
  =/  id  (required:spec args 'message_id' 256)
  ?:  &(delete !=(id (required:spec args 'confirm' 256)))  !!
  =/  content  (text-to-story:story ?:(delete '' (required:spec args 'text' 16.384)))
  ?-  -.to
      %dm
    ?>  delete
    =/  id  (dm-id:spec id)
    ?>  =(our.bowl -.id)
    =/  post  (dm-post who.to ?~(parent.to id u.parent.to))
    =/  delta=diff:dm:v7:cv
      ?~  parent.to  [id %del ~]
      =/  reply  (dm-reply post id)
      ?>  =(id id.reply)
      [u.parent.to %reply id ~ %del ~]
    [%pass wire %agent [our.bowl %chat] %poke %chat-dm-action-2 !>(`action:dm:v7:cv`[who.to delta])]
      %channel
    =/  id  (timestamp:spec id)
    =/  post  (channel-post nest.to ?~(parent.to id u.parent.to))
    =/  command=a-channels:v10:dv
      ?~  parent.to
        ?:  delete  [%channel nest.to %post %del id]
        ?>  =(our.bowl author:+.+.post)
        [%channel nest.to %post %edit id +.+.post(content content)]
      =/  reply  (channel-reply nest.to u.parent.to id)
      ?:  delete  [%channel nest.to %post %reply u.parent.to %del id]
      ?>  =(our.bowl author:+.+.reply)
      [%channel nest.to %post %reply u.parent.to %edit id +.+.reply(content content)]
    [%pass wire %agent [our.bowl %channels] %poke %channel-action-2 !>(command)]
  ==
--

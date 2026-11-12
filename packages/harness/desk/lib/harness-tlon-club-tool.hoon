::  Group DMs use their own native identity, never a fabricated channel nest.
/-  c=chat-ver, dv=channels-ver
/+  spec=harness-tlon-tool,
    hp=harness-tlon-history-page,
    hist=harness-tlon-history,
    story=harness-tlon-story,
    message=harness-tlon-message-tool, paths=harness-tlon-paths
|_  bowl=bowl:gall
+*  read-path  ~(. paths [our now]:bowl)
++  handles
  |=  action=@t
  =/  actions=(list @t)
    :~  'list_clubs'
        'get_club'
        'create_club'
        'invite_to_club'
        'accept_club_invite'
        'decline_club_invite'
        'leave_club'
        'send_club'
        'club_history'
        'search_club_history'
        'get_club_message'
        'delete_club_message'
    ==
  (lien actions |=(value=@t =(value action)))
++  clubs
  ^-  (map id:club:v7:c crew:club:v7:c)
  ?>  .^(? %gu /(scot %p our.bowl)/chat/(scot %da now.bowl)/$)
  .^((map id:club:v7:c crew:club:v7:c) %gx /(scot %p our.bowl)/chat/(scot %da now.bowl)/clubs/noun)
++  club-id
  |=  args=json
  ^-  id:club:v7:c
  =/  raw  (required:spec args 'club' 128)
  =/  id  (slav %uv raw)
  ?>  &(=(raw (scot %uv id)) (lte (met 0 id) 128))
  id
++  metadata
  |=  [id=id:club:v7:c crew=crew:club:v7:c]
  =/  ships
    |=  values=(set @p)
    :-  %a
    (turn ~(tap in values) |=(who=@p [%s (scot %p who)]))
  %-  pairs:enjs:format
  :~  ['club' %s (scot %uv id)]
      ['title' %s title.met.crew]
      ['state' %s net.crew]
      ['members' (ships team.crew)]
      ['invited' (ships hive.crew)]
  ==
::  Native positions drive pagination, including rows for deleted messages.
++  history
  |=  [args=json id=id:club:v7:c action=@t]
  ^-  json
  =/  parent=(unit [@p @da])
    ?:((has:spec args 'parent') `(dm-id:spec (required:spec args 'parent' 256)) ~)
  =/  needle  ?:(=('search_club_history' action) (query:hp args) '')
  =/  scope  (sham [%tlon-club our.bowl id parent needle])
  =/  before  (position:hp scope (string:spec args 'cursor' '' 256))
  =/  count  ?:(=('' needle) 21 65)
  =/  snapshot=[parent=(unit message:hp) rows=(list row:hp)]
    ?^  parent
      =/  post=(may:v7:c writ:v7:c)
        .^  (may:v7:c writ:v7:c)  %gx
          (club-post:read-path id u.parent)
        ==
      ?>  ?=(%& -.post)
      =/  rows
        ?~  before
          (top:dm-replies:hist replies:+.post count)
        (bat:dm-replies:hist replies:+.post before count)
      :-  `(dm-post:hp +.post)
      %+  turn  rows
      |=  [at=@da value=(may:v7:c reply:v7:c)]
      ^-  row:hp
      [at ?:(?=(%| -.value) ~ `(dm-reply:hp +.value))]
    =/  window=path
      ?~  before
        /newest/(scot %ud count)
      /older/(scot %ud u.before)/(scot %ud count)
    =/  target=path
      %+  weld
        /(scot %p our.bowl)/chat/(scot %da now.bowl)/v4/club/(scot %uv id)/writs
      (weld window /light/chat-paged-writs-4)
    =/  page=paged-writs:v7:c  .^(paged-writs:v7:c %gx target)
    :-  ~
    %+  turn  (tap:on:writs:v7:c writs.page)
    |=  [at=@da value=(may:v7:c writ:v7:c)]
    ^-  row:hp
    [at ?:(?=(%| -.value) ~ `(dm-post:hp +.value))]
  (encode:hp scope (scan:hp rows.snapshot needle) parent.snapshot needle)
::  Invitations can be answered before joining; other changes require membership.
++  change
  |=  [args=json action=@t crew=crew:club:v7:c sent=@da]
  ^-  delta:club:v7:c
  ?:  |(=('accept_club_invite' action) =('decline_club_invite' action))
    ?>  =(%invited net.crew)
    [%team our.bowl =('accept_club_invite' action)]
  ?>  &((~(has in team.crew) our.bowl) =(%done net.crew))
  ?:  =('leave_club' action)  [%team our.bowl |]
  ?:  =('invite_to_club' action)  [%hive our.bowl (ship:spec (required:spec args 'ship' 128)) &]
  ?>  =('send_club' action)
  =/  =memo:v9:dv  [(text-to-story:story (required:spec args 'text' 16.384)) our.bowl sent]
  :-  %writ
  ?.  (has:spec args 'parent')  [[our.bowl sent] %add [memo chat+/ ~ ~] `sent]
  [(dm-id:spec (required:spec args 'parent' 256)) %reply [our.bowl sent] ~ %add [memo ~] `sent]
++  run
  |=  [args=json wire=wire sent=@da]
  ^-  [body=@t effect=(unit card:agent:gall)]
  =/  action  (required:spec args 'action' 32)
  ?:  =('list_clubs' action)
    [(en:json:html (directory:spec args (turn ~(tap by clubs) metadata))) ~]
  ?:  =('create_club' action)
    =/  =id:club:v7:c  (end [7 1] (sham [our.bowl sent wire]))
    ?>  !(~(has by clubs) id)
    =/  who  (ship:spec (required:spec args 'ship' 128))
    ?>  !=(our.bowl who)
    :-  %:  rap
          3
          'accepted: local group DM creation; club='
          (scot %uv id)
          '; invitees have not necessarily joined'
          ~
        ==
    :-  ~
    :*  %pass  wire  %agent  [our.bowl %chat]  %poke  %chat-club-create
        !>(`create:club:v7:c`[id (silt ~[who])])
    ==
  =/  id  (club-id args)
  =/  crew  (~(got by clubs) id)
  ?:  =('get_club' action)  [(en:json:html (metadata id crew)) ~]
  ?:  |(=('get_club_message' action) =('delete_club_message' action))
    =/  raw  (required:spec args 'message_id' 256)
    =/  message-id  (dm-id:spec raw)
    =/  parent=(unit [@p @da])
      ?:((has:spec args 'parent') `(dm-id:spec (required:spec args 'parent' 256)) ~)
    =/  root  (fall parent message-id)
    =/  post=(may:v7:c writ:v7:c)
      .^  (may:v7:c writ:v7:c)  %gx
        (club-post:read-path id root)
      ==
    ?>  ?=(%& -.post)
    =/  record
      ?~  parent  (dm-post:hp +.post)
      (dm-reply:hp (dm-reply:~(. message bowl) +.post message-id))
    ?:  =('get_club_message' action)
      [(en:json:html (render:~(. message bowl) args record)) ~]
    ?>  ?&  =(raw (required:spec args 'confirm' 256))
            =(our.bowl author.record)
            (~(has in team.crew) our.bowl)
            =(%done net.crew)
        ==
    =/  =diff:dm:v7:c
      ?~  parent  [message-id %del ~]
      [u.parent %reply message-id ~ %del ~]
    =/  command=action:club:v7:c  [id (sham [wire sent]) %writ diff]
    :-  'accepted: local Tlon acknowledged group DM deletion; remote completion is not confirmed'
    `[%pass wire %agent [our.bowl %chat] %poke %chat-club-action-2 !>(command)]
  ?:  |(=('club_history' action) =('search_club_history' action))
    [(en:json:html (history args id action)) ~]
  =/  delta  (change args action crew sent)
  =/  command=action:club:v7:c  [id (sham [wire sent]) delta]
  :-  'accepted: local Tlon acknowledged the group DM action; remote completion is not confirmed'
  `[%pass wire %agent [our.bowl %chat] %poke %chat-club-action-2 !>(command)]
--

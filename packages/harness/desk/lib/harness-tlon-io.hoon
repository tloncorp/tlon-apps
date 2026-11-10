::  Messenger effects and contact projection. Only this module knows which
::  public Gall marks a DM, channel post, or invitation needs.
/-  t=harness-tlon, dv=channels-ver, cv=chat-ver,
    ct=contacts, a=activity-ver, mt=meta
/+  story=harness-tlon-story, profile=harness-tlon-profile,
    ht=harness-tools, publication=harness-tlon-publication,
    hist=harness-tlon-history, onboarding=harness-tlon-onboarding,
    paths=harness-tlon-paths
|_  bowl=bowl:gall
+*  read-path  ~(. paths [our now]:bowl)
+$  card  card:agent:gall
::
++  owner-invitations
  |=  owner-test=$-(@p ?)
  ^-  (list card)
  ?.  .^(? %gu /(scot %p our.bowl)/chat/(scot %da now.bowl)/$)  ~
  =/  invited=(set @p)
    .^((set @p) %gx /(scot %p our.bowl)/chat/(scot %da now.bowl)/dm/invited/ships)
  %+  murn  ~(tap in invited)
  |=  who=@p
  ^-  (unit card)
  ?.  (owner-test who)  ~
  `[%pass /invite/dm/(scot %p who) %agent [our.bowl %chat] %poke %chat-dm-rsvp !>([who &])]
::
++  publish
  |=  [wire=wire to=destination:t text=@t sent=@da blob=(unit @t)]
  ^-  card
  (publish-story wire to (text-to-story:story text) sent ~ blob)
::
::  +publish-story: post content; channel posts also take metadata
::
++  publish-story
  |=  $:  wire=wire  to=destination:t  content=story:v9:dv  sent=@da
          meta=(unit data:mt)  blob=(unit @t)
      ==
  ^-  card
  =/  =memo:v9:dv  [content our.bowl sent]
  ?-  -.to
      %dm
    =/  =diff:dm:v7:cv
      ?~  parent.to  [[our.bowl sent] %add [memo chat+/ ~ blob] `sent]
      ::  Parent is the author's durable writ id, not activity's local time.
      [u.parent.to %reply [our.bowl sent] ~ %add [memo blob] `sent]
    [%pass wire %agent [our.bowl %chat] %poke %chat-dm-action-2 !>(`action:dm:v7:cv`[who.to diff])]
      %channel
    ::  Use the versioned client action: Groups owns host negotiation. Its
    ::  later channel-response confirms the host-assigned post/reply identity.
    =/  action=a-channels:v10:dv
      ?~  parent.to  [%channel nest.to %post %add [memo [kind.nest.to ~] meta blob]]
      [%channel nest.to %post %reply u.parent.to %add [memo blob]]
    [%pass wire %agent [our.bowl %channels] %poke %channel-action-2 !>(action)]
  ==
::
++  published
  |=  [to=destination:t external=@t]
  ^-  (unit publication-proof:t)
  ?.  ?=(%channel -.to)  ~
  ?.  .^(? %gu /(scot %p our.bowl)/channels/(scot %da now.bowl)/$)  ~
  ::  Read the versioned native cache once on recovery, never poll it. Missing
  ::  channels/parents are ordinary map misses, not uncatchable failed scries.
  =/  channels=v-channels:v9:dv
    .^(v-channels:v9:dv %gx /(scot %p our.bowl)/channels/(scot %da now.bowl)/v4/v-channels/noun)
  =/  channel  (~(get by channels) nest.to)
  ?~  channel  ~
  =/  candidates=(list publication-proof:t)
    ?~  parent.to
      %+  murn  (top:mo-v-posts:v9:dv posts.u.channel 64)
      |=  [id=@da value=(may:v9:dv v-post:v9:dv)]
      ?:  ?=(%| -.value)  ~
      =/  post  +.value
      (proof:publication our.bowl to author:+.+.post sent:+.+.post id)
    =/  parent  (get:on-v-posts:v9:dv posts.u.channel u.parent.to)
    ?.  ?=([~ %& *] parent)  ~
    %+  murn  (top:mo-v-replies:v9:dv replies.u.parent 64)
    |=  [id=@da value=(may:v9:dv v-reply:v9:dv)]
    ?:  ?=(%| -.value)  ~
    =/  reply  +.value
    (proof:publication our.bowl to author:+.+.reply sent:+.+.reply id)
  =/  found
    %+  skim  candidates
    |=  proof=publication-proof:t
    =(external (rap 3 (scot %p our.bowl) '/' (scot %da sent.proof) ~))
  ?~(found ~ `i.found)
::
++  invitation-posts
  |=  [who=@p since=@da]
  ^-  (list incoming-event:v8:a)
  ::  The first DM arrives as an invitation, not a post notification. After
  ::  accepting, project a bounded page through the usual admission gate.
  ::  Original writ ids make overlap with live activity idempotent.
  =/  page=paged-writs:v7:cv
    .^  paged-writs:v7:cv  %gx
      (weld (dm-writs:read-path who) /newest/64/light/chat-paged-writs-4)
    ==
  %+  murn  (tap:on:writs:v7:cv writs.page)
  |=  [time=@da item=(may:v7:cv writ:v7:cv)]
  ^-  (unit incoming-event:v8:a)
  ?.  ?=(%& -.item)  ~
  =/  post  +.item
  ?.  ?&  =(who p.id:-.post)
          (gth time since)
          =(chat+/ kind:+.post)
      ==
    ~
  `[%dm-post [id:-.post time] [%ship who] content:+.post |]
::
++  onboarding-request
  |=  event=incoming-event:v8:a
  ^-  (unit @t)
  ::  Activity does not carry blobs. Read only the exact native post, never a
  ::  conversation-wide search that could attach somebody else's setup data.
  ?+  -.event  ~
      %dm-post
    ?.  ?=(%ship -.whom.event)  ~
    =/  post=(may:v7:cv writ:v7:cv)
      .^  (may:v7:cv writ:v7:cv)  %gx
        (dm-post:read-path p.whom.event id.key.event)
      ==
    ?:  ?=(%| -.post)  ~
    (request:onboarding p.id.key.event blob:+.+.post)
      %post
    =/  post=(may:v9:dv post:v9:dv)
      .^  (may:v9:dv post:v9:dv)  %gx
        %+  weld  (channel-posts:read-path %v4 channel.event)
        /post/id/(scot %ud time.key.event)/channel-post-4
      ==
    ?:  ?=(%| -.post)  ~
    (request:onboarding p.id.key.event blob:+.+.+.post)
  ==
::
++  history
  |=  to=destination:t
  ^-  (list [id=@t author=@p sent=@da text=@t])
  ?-  -.to
      %dm
    ?^  parent.to
      =/  post=(may:v7:cv writ:v7:cv)
        .^  (may:v7:cv writ:v7:cv)  %gx
          (dm-post:read-path who.to u.parent.to)
        ==
      ?:  ?=(%| -.post)  ~
      (dm-thread:hist +.post)
    =/  page=paged-writs:v7:cv
      .^  paged-writs:v7:cv  %gx
        (weld (dm-writs:read-path who.to) /newest/20/light/chat-paged-writs-4)
      ==
    %+  murn  (tap:on:writs:v7:cv writs.page)
    |=  [time=@da item=(may:v7:cv writ:v7:cv)]
    ^-  (unit [id=@t author=@p sent=@da text=@t])
    ?.  ?=(%& -.item)  ~
    =/  post  +.item
    =/  author  author:+.post
    :-  ~
    :*  (rap 3 (scot %p p.id:-.post) '/' (scot %da q.id:-.post) ~)
        ?@(author author ship.author)
        sent:+.post
        (clip:ht (story-to-text:story content:+.post) 800)
    ==
      %channel
    ?^  parent.to
      ::  Fetch one outline around the exact parent, never all thread replies.
      =/  page=paged-posts:v9:dv
        .^  paged-posts:v9:dv  %gx
          %+  weld  (channel-posts:read-path %v4 nest.to)
          /older/(scot %ud +(u.parent.to))/1/outline/channel-posts-4
        ==
      =/  post  (get:on-posts:v9:dv posts.page u.parent.to)
      ?>  ?=([~ %& *] post)
      =/  =replies:v9:dv
        .^  replies:v9:dv  %gx
          %+  weld  (channel-replies:read-path %v4 nest.to u.parent.to)
          /newest/19/channel-replies-4
        ==
      (channel-thread:hist +.u.post replies)
    =/  page=paged-posts:v9:dv
      .^  paged-posts:v9:dv  %gx
        (weld (channel-posts:read-path %v4 nest.to) /newest/20/outline/channel-posts-4)
      ==
    %+  murn  (tap:on-posts:v9:dv posts.page)
    |=  [time=@da item=(may:v9:dv post:v9:dv)]
    ^-  (unit [id=@t author=@p sent=@da text=@t])
    ?.  ?=(%& -.item)  ~
    =/  post  +.item
    =/  author  author:+.+.post
    :-  ~
    :*  (scot %da id:-.post)
        ?@(author author ship.author)
        sent:+.+.post
        (clip:ht (story-to-text:story content:+.+.post) 800)
    ==
  ==
::
++  history-json
  |=  to=destination:t
  ^-  json
  :-  %a
  %+  turn  (history to)
  |=  [id=@t author=@p sent=@da text=@t]
  %-  pairs:enjs:format
  :~  ['message_id' %s id]
      ['author' %s (scot %p author)]
      ['sent' %s (scot %da sent)]
      ['text' %s text]
  ==
::
++  reaction
  |=  [wire=wire to=destination:t message=@t emoji=(unit @t)]
  ^-  card
  ::  Match a concrete message in the bounded current-chat projection. A
  ::  guessed ID or a model-supplied destination cannot expand this effect.
  ?>  %+  lien  (history to)
      |=  [id=@t author=@p sent=@da text=@t]
      =(id message)
  ?-  -.to
      %dm
    =/  parts  (need (rush (cat 3 '/' message) stap))
    ?>  ?=([@ @ ~] parts)
    =/  =id:v7:cv  [(slav %p i.parts) (slav %da i.t.parts)]
    =/  =delta:writs:v7:cv
      ?:  |(?=(~ parent.to) =(id u.parent.to))
        ?~(emoji [%del-react our.bowl] [%add-react our.bowl u.emoji])
      [%reply id ~ ?~(emoji [%del-react our.bowl] [%add-react our.bowl u.emoji])]
    =/  root
      ?:  |(?=(~ parent.to) =(id u.parent.to))  id
      u.parent.to
    :*  %pass  wire  %agent  [our.bowl %chat]  %poke  %chat-dm-action-2
        !>(`action:dm:v7:cv`[who.to root delta])
    ==
      %channel
    =/  id=@da  (slav %da message)
    =/  action=a-channels:v9:dv
      ?:  |(?=(~ parent.to) =(id u.parent.to))
        [%channel nest.to %post ?~(emoji [%del-react id our.bowl] [%add-react id our.bowl u.emoji])]
      :*  %channel  nest.to  %post  %reply  u.parent.to
          ?~(emoji [%del-react id our.bowl] [%add-react id our.bowl u.emoji])
      ==
    [%pass wire %agent [our.bowl %channels] %poke %channel-action-1 !>(action)]
  ==
::
++  self-profile
  ^-  json
  %-  encode:profile
  .^(contact:ct %gx /(scot %p our.bowl)/contacts/(scot %da now.bowl)/v1/self/contact-1)
::
++  liveness
  |=  online=?
  ^-  (unit card)
  ?.  .^(? %gu /(scot %p our.bowl)/contacts/(scot %da now.bowl)/$)  ~
  =/  con
    .^(contact:ct %gx /(scot %p our.bowl)/contacts/(scot %da now.bowl)/v1/self/contact-1)
  =/  patch  (liveness:profile online con)
  ?~  patch  ~
  `(edit-profile /liveness patch)
::
++  edit-profile
  |=  [wire=wire fields=contact:ct]
  ^-  card
  [%pass wire %agent [our.bowl %contacts] %poke %contact-action-1 !>(`action:ct`[%self fields])]
::
++  contacts
  ^-  json
  =/  =directory:ct
    .^  directory:ct  %gx
      /(scot %p our.bowl)/contacts/(scot %da now.bowl)/v1/directory/contact-directory-0
    ==
  :-  %a
  %+  turn  ~(tap by directory)
  |=  [who=@p leaf=leaf:ct]
  ::  Remote fields take priority; local fields fill gaps in the profile.
  =/  merged  (~(uni by mod.leaf) con.leaf)
  =/  nick  (~(get by merged) %nickname)
  %-  pairs:enjs:format
  :~  ['ship' %s (scot %p who)]
      ['nickname' %s ?:(?=([~ %text *] nick) p.u.nick '')]
      ['contact' %b contact.leaf]
  ==
--

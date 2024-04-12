/-  c=channels, ch=chat, g=groups
/+  mp=mop-extensions
|%
++  on-event      ((on time event) lte)
++  ex-event      ((mp time event) lte)
++  on-parent     ((on time event-parent) lte)
+$  stream  ((mop time event) lte)
+$  indices  (map index [=stream =reads])
+$  reads
  $:  floor=time      ::  latest time above which everything is read
      =event-parents  ::
  ==
+$  event-parent  [seen=? reply-floor=time]
+$  event-parents  ((mop time-id event-parent) lte)
+$  index
  $%  [%channel channel=nest:c]
      [%dm =whom]
  ==
+$  flavor
  $?  %dm-invite
      %dm-post
      %dm-post-mention
      %dm-reply
      %dm-reply-mention
      %group-invite
      %kick
      %join
      %ask
      %role
      %post
      %post-mention
      %reply
      %reply-mention
      %flag-post
      %flag-reply
  ==
+$  flavor-level  ?(%notify %default)
+$  volume  (map index index-level)
+$  index-level
  $~  %soft
  $?  %loud  ::  always notify
      %soft  ::  sometimes notify
      %hush  ::  never notify
  ==
+$  event
  $%  [%dm-invite dm-concern]
      [%dm-post dm-post-concern content=story:c mention=?]
      [%dm-reply dm-reply-concern content=story:c mention=?]
      [%kick group-concern =ship]
      [%group-invite group-concern =ship]
      [%join group-concern =ship]
      [%ask group-concern =ship]
      [%role group-concern =ship roles=(set sect:g)]
      [%post post-concern content=story:c mention=?]
      [%reply reply-concern content=story:c mention=?]
      [%flag-post post-concern]
      [%flag-reply reply-concern]
  ==
+$  time-event  [=time =event]
+$  group-concern     group=flag:g
+$  channel-concern   [channel=nest:c group=flag:g]
+$  dm-concern        =whom
+$  dm-post-concern   [=message-key =whom]
+$  dm-reply-concern  [=message-key parent=message-key =whom]
+$  post-concern      [=message-key channel=nest:c group=flag:g]
+$  reply-concern     [=message-key parent=message-key channel=nest:c group=flag:g]
+$  whom
  $%  [%ship p=ship]
      [%club p=id:club:ch]
  ==
+$  time-id  time
+$  message-id   (pair ship time-id)
+$  message-key  [id=message-id =time]
+$  action
  $%  [%add =event]
      [%read =index =read-action]
      [%adjust =index =index-level]
  ==
+$  unread-threads  (map message-key [message-key count=@ud])
+$  unread-summary
  $:  newest=time
      count=@ud
      unread=(unit [message-key count=@ud])
      threads=unread-threads
  ==
+$  unreads  (map index unread-summary)
+$  read-action
  $%  [%thread id=time-id]  ::  mark a whole thread as read
      [%post id=time-id]    ::  mark an individual post as read
      [%all ~]            ::  mark _everything_ as read
  ==
+$  full-info  [=stream =indices =unreads]
--

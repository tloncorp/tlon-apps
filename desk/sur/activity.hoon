/-  c=channels
/+  mp=mop-extensions
|%
++  eon     ((on time event) lte)
++  emp     ((mp time event) lte)
++  mep     ((on time event-parent) lte)
+$  stream  ((mop time event) lte)
+$  indices  (map index [=stream =reads])
+$  reads
  $:  floor=time      ::  latest time above which everything is read
      =event-parents  ::
  ==
+$  event-parent  [seen=? reply-floor=time]
+$  event-parents  ((mop timid event-parent) lte)
+$  index
  $%  [%channel channel-concern]
      [%dm dm-concern]
  ==
+$  volume  (map flavor level)
+$  flavor
  $?  %dm-invite
      %dm-post
      %dm-post-mention
      %dm-reply
      %dm-reply-mention
      %kick
      %join
      %post
      %post-mention
      %reply
      %reply-mention
      %flag
  ==
+$  level  ?(%notify %default %trivial)
+$  event
  $%  [%dm-invite dm-concern]
      [%dm-post dm-post-concern content=story:c mention=?]
      [%dm-reply dm-reply-concern content=story:c mention=?]
      [%kick group-concern =ship]
      [%join group-concern =ship]
      [%post post-concern content=story:c mention=?]
      [%reply reply-concern content=story:c mention=?]
      [%flag post-concern]
  ==
+$  group-concern     group=flag:c
+$  channel-concern   [channel=nest:c group=flag:c]
+$  dm-concern        =whom
+$  dm-post-concern   [=message-key =whom]
+$  dm-reply-concern  [=message-key target=message-key =whom]
+$  post-concern      [=message-key channel=nest:c group=flag:c]
+$  reply-concern     [=message-key target=message-key channel=nest:c group=flag:c]
+$  whom
  $%  [%ship p=ship]
      [%club p=@uvH]
  ==
+$  timid  time
+$  message-id   (pair ship timid)
+$  message-key  [id=message-id =time]
+$  action
  $%  [%add =event]
      [%read =index =read-action]
      [%adjust =flavor =level]
  ==
+$  unread-summary
  $:  newest=time
      count=@ud
      threads=(list [oldest-unread=time count=@ud])
  ==
+$  read-action
  $%  [%thread id=timid]  ::  mark a whole thread as read
      [%post id=timid]    ::  mark an individual post as read
      [%all ~]            ::  mark _everything_ as read
  ==
--

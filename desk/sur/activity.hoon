/+  mp=mop-extensions
|%
+$  stream  ((mop time event) lte)
+$  eon     ((on time event) lte)
++  emp     ((mp time event) lte)
+$  indices  (map index [=stream =reads])
+$  reads  [floor=time (set event-id=time)]
+$  index
  $%  [%channel channel-concern]
      [%dm dm-concern]
  ==
+$  volume  (map flavor level)
+$  flavor
  $?  %dm-invite
      %dm-post
      %kick
      %join
      %post
      %post-mention
      %reply
      %flag
  ==
+$  level  ?(%notify %default %trivial)
+$  event
  $%  [%dm-invite dm-concern]
      [%dm-post dm-post-concern =content mention=?]
      [%kick group-concern =ship]
      [%join group-concern =ship]
      [%post post-concern =content mention=?]
      [%reply reply-concern =content mention=?]
      [%flag post-concern]
  ==
+$  group-concern    group=flag
+$  channel-concern  [channel=nest group=flag]
+$  dm-concern       =whom
+$  dm-post-concern  [=message-key =whom]
+$  post-concern     [=message-key channel=nest group=flag]
+$  reply-concern    [=message-key target=message-key channel=nest group=flag]
+$  whom
  $%  [%ship p=ship]
      [%club p=id:club]
  ==
+$  message-key  [=id =time]
+$  content
  ::  same as content of actual message
  ~
+$  action
  $%  [%add =event]
      [%read =read-action]
      [%adjust =flavor =level]
  ==
+$  unread-summary  [time count=@ud threads=(list [time count=@ud])]
+$  read-action
  $%  [%last-seen =time]
      [%thread =time]
      [%post =time]
  ==
--

|%
+$  state
  $:  stream=(mop time event)
      indices=(map concern stream)
  ==
+$  concern
  $%  [%group group-concern]
      [%channel channel-concern]
      [%dm dm-concern]
      [%post post-concern]
      [%writ writ-concern]
  ==
+$  group-concern    group=flag
+$  channel-concern  [channel=nest group=flag]
+$  dm-concern       =whom
+$  post-concern     [=post-key channel=nest group=flag]
+$  writ-concern     [=writ-key =whom]
::  $event: an instance of activity
::
::    $flavor: what activity generated the event and where did it happen
::    $content: text of the message that generated the event or a description
::    $level: what "level" of importance this is deemed by originator
::    $read: has this event been seen or interacted with
::
+$  event  [=flavor =level =content read=?]
+$  level  ?(%notify %default %trivial)
+$  content
  $@  @t
  $%  [%ship p=ship]
      [%emph p=cord]
  ==
+$  flavor
  ::  specific occasions TBD
  $%  [%group group-concern occasion=?(%join %kick)]
      [%channel channel-concern occasion=?(%message %mention %reply %notice)]
      [%dm dm-concern occasion=?(%message %mention %reply %notice)]
      [%post post-concern occasion=?(%message %mention %reply %notice)]
      [%writ writ-concern occasion=?(%message %mention %reply %notice)]
  ==
::
::  this is similar to the way unreads are handled for DMs. in the case of
::  chats, recency will just happen to be the same as the key time.
::
++  unreads
  =<  unreads
  |%
  +$  unreads
    (map whom unread)
  +$  unread
    $:  count=@ud
        unread=(unit [message-key count=@ud])
        threads=(map message-key [message-key count=@ud])
    ==
  +$  update
    (pair whom unread)
  --
+$  message-key
  $%  [%time =id =time]
      [%recency =id =time recency=time]
  ==
+$  whom
  $%  [%ship p=ship]
      [%club p=id:club]
  ==
--

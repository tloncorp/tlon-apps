|%
+$  stream  (mop time event)
+$  indices  (map index [=stream =reads])
+$  reads  [floor=time (set event-id=time)]
+$  derived-unreads  [time count=@ud threads=(list [time count=@ud])]
+$  index
  $%  [%channel channel-concern]
      [%dm dm-concern]
  ==
+$  group-concern    group=flag
+$  channel-concern  [channel=nest group=flag]
+$  dm-concern       =whom
+$  post-concern     [=message-key channel=nest group=flag]
+$  reply-concern    [=message-key target=message-key channel=nest group=flag]
+$  dm-post-concern  [=writ-key =whom]
::  $event: an instance of activity
::
::    $flavor: what activity generated the event and where did it happen
::    $content: text of the message that generated the event or a description
::    $level: what "level" of importance this is deemed by originator
::    $read: has this event been seen or interacted with
::
+$  event  [=flavor =level]
+$  level  ?(%notify %default %trivial)
+$  content
  ::  same as content of actual message
  ~
+$  flavor
  $%  [%dm-invite dm-concern]
      [%dm-post dm-post-concern =content mention=?]
      [%kick group-concern =ship]
      [%join group-concern =ship]
      [%post post-concern =content mention=?]
      [%reply reply-concern =content mention=?]
      [%flag post-concern]
  ==
+$  whom
  $%  [%ship p=ship]
      [%club p=id:club]
  ==
+$  message-key  [=id =time]
--

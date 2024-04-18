/-  c=channels, ch=chat, g=groups
/+  mp=mop-extensions
|%
+|  %collections
::  $stream: the activity stream comprised of events from various agents
+$  stream  ((mop time event) lte)
::  $indices: the stream and its read data split into various indices
+$  indices  (map source [=stream =reads])
::  $volume-settings: the volume settings for each source
+$  volume-settings  (map source volume-level)
::  $unreads: the current unread state for each source
+$  unreads  (map source unread-summary)
::  TODO: kill?
::  $full-info: the full state of the activity stream
+$  full-info  [=stream =indices =unreads]
+|  %actions
::  $action: how to interact with our activity stream
::
::    actions are only ever performed for and by our selves
::
::    $add: add an event to the stream
::    $read: mark an event as read
::    $adjust: adjust the volume of an source
::
+$  action
  $%  [%add =event]
      [%read =source =read-action]
      [%adjust =source =volume]
  ==
::
::  $read-action: mark activity read
::
::    $thread: mark a whole thread as read
::    $post: mark an individual post as read
::    $all: mark _everything_ as read for this source
::
+$  read-action
  $%  [%thread id=time-id]
      [%post id=time-id]
      [%all ~]
  ==
::
+|  %updates
::
::  $update: what we hear after an action
::
::    $added: an event was added to the stream
::    $read: a source's unread state was updated
::    $adjusted: the volume of a source was adjusted
::
+$  update
  $%  [%added =time-event]
      [%read =source =unread-summary]
      [%adjusted =source =volume]
  ==
::
+|  %basics
::  $event: a single point of activity, from one of our sources
+$  event
  $%  [%post post-event]
      [%reply reply-event]
      [%dm-invite =whom]
      [%dm-post dm-post-event]
      [%dm-reply dm-reply-event]
      [%group-ask group=flag:g =ship]
      [%group-kick group=flag:g =ship]
      [%group-join group=flag:g =ship]
      [%group-invite group=flag:g =ship]
      [%group-role group=flag:g =ship roles=(set sect:g)]
      [%flag-post key=message-key channel=nest:c]
      [%flag-reply key=message-key parent=message-key channel=nest:c]
  ==
::
+$  post-event
  $:  key=message-key
      channel=nest:c
      content=story:c
      mention=?
  ==
::
+$  reply-event
  $:  key=message-key
      parent=message-key
      channel=nest:c
      content=story:c
      mention=?
  ==
::
+$  dm-post-event
  $:  key=message-key
      whom=whom
      content=story:c
      mention=?
  ==
::
+$  dm-reply-event
  $:  key=message-key
      parent=message-key
      whom=whom
      content=story:c
      mention=?
  ==
::
::  $source: where the activity is happening
+$  source
  $%  [%channel channel=nest:c]
      [%dm =whom]
  ==
::
::  $reads: the read state for a source
::
::    $floor: the time of the latest event that was read
::    $posts: the set of posts above the floor that have been read or
::            had their threads read
::
+$  reads
  $:  floor=time
      posts=post-reads
  ==
::
::  $post-read: whether a post has been read and the point of read replies
+$  post-read  [seen=? floor=time]
+$  post-reads  ((mop time-id post-read) lte)
::  $unread-summary: the summary of unread activity for a source
::
::    $newest: the time of the latest activity read or unread
::    $count: the total number of unread events including threads
::    $unread: if the main stream of source is unread, which starting
::             message, and how many there are
::    $threads: the threads that are unread
::
+$  unread-summary
  $:  newest=time
      count=@ud
      unread=(unit [message-key count=@ud])
      threads=unread-threads
  ==
+$  unread-threads  (map message-key [message-key count=@ud])
+|  %primitives
+$  whom
  $%  [%ship p=ship]
      [%club p=id:club:ch]
  ==
+$  time-id  time
+$  message-id   (pair ship time-id)
+$  message-key  [id=message-id =time]
::  $volume: how much we alert and badge for a given source
::
::    $loud: always notify, show loud unreads
::    $default: sometimes notify, show soft unreads
::    $soft: never notify, show soft unreads
::    $hush: never notify, show no unreads
::
+$  volume
  $~  %default
  $?  %loud
      %default
      %soft
      %hush
  ==
::
+$  event-type
  $?  %post
      %post-mention
      %reply
      %reply-mention
      %dm-invite
      %dm-post
      %dm-post-mention
      %dm-reply
      %dm-reply-mention
      %group-invite
      %group-kick
      %group-join
      %group-ask
      %group-role
      %flag-post
      %flag-reply
  ==
+$  notify-level  ?(%notify %default)
+|  %helpers
++  on-event    ((on time event) lte)
++  ex-event    ((mp time event) lte)
++  on-parent   ((on time event-parent) lte)
+$  time-event  [=time =event]
--

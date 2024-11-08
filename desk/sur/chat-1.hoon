/-  g=groups, graph-store
/-  meta
/-  metadata-store
/-  cite
/-  e=epic
/+  lib-graph=graph-store
|%
::  $writ: a chat message
+$  writ   [seal memo]
::  $id: an identifier for chat messages
+$  id     (pair ship time)
::  $feel: either an emoji identifier like :wave: or a URL for custom
+$  feel   @ta
+$  said   (pair flag writ)
::
::  $seal: the id of a chat and its meta-responses
::
::    id: the id of the message  
::    feels: reactions to a message
::    replied: set of replies to a message
::
+$  seal
  $:  =id
      feels=(map ship feel)
      replied=(set id)
  ==
::
::  $whom: a polymorphic identifier for chats
::
+$  whom
  $%  [%flag p=flag]
      [%ship p=ship]
      [%club p=id:club]
  == 
::
::  $briefs: a map of chat/club/dm unread information
::
::    brief: the last time a message was read, how many messages since,
::    and the id of the last read message
::
++  briefs
  =<  briefs
  |% 
  +$  briefs
    (map whom brief)
  +$  brief
    [last=time count=@ud read-id=(unit id)]
  +$  update
    (pair whom brief)
  --
::
+$  remark-action
  (pair whom remark-diff)
::
+$  remark-diff
  $%  [%read ~]
      [%read-at p=time]
      [?(%watch %unwatch) ~]
  ==
::
::  $flag: an identifier for a $chat channel
::
+$  flag  (pair ship term)
::
::  $diff: represents an update to state
::
::    %writs: a chat message update
::    %add-sects: add sects to writer permissions
::    %del-sects: delete sects from writers
::    %create: create a new chat
::
+$  diff
  $%  [%writs p=diff:writs]
    ::
      [%add-sects p=(set sect:g)]
      [%del-sects p=(set sect:g)]
    ::
      [%create p=perm q=pact]
  ==
::  $index: a map of chat message id to server received message time
::
+$  index   (map id time)
::
::  $pact: a double indexed map of chat messages, id -> time -> message
::
+$  pact
  $:  wit=writs
      dex=index
  ==
::
::  $club: a direct line of communication between multiple parties
::
::    uses gossip to ensure all parties keep in sync
::
++  club
  =<  club
  |%
  ::  $id: an identification signifier for a $club
  ::
  +$  id  @uvH
  ::  $net: status of club
  ::
  +$  net  ?(%archive %invited %done)
  +$  club  [=remark =pact crew]
  ::
  ::  $crew: a container for the metadata for the club
  ::
  ::    team: members that have accepted an invite
  ::    hive: pending members that have been invited
  ::    met: metadata representing club
  ::    net: status
  ::    pin: should the $club be pinned to the top
  ::
  +$  crew
    $:  team=(set ship)
        hive=(set ship)
        met=data:meta
        =net
        pin=_|
    ==
  ::  $rsvp: a $club invitation response
  ::
  +$  rsvp    [=id =ship ok=?]
  ::  $create: a request to create a $club with a starting set of ships
  ::
  +$  create
    [=id hive=(set ship)]
  ::  $invite: the contents to send in an invitation to someone
  ::
  +$  invite  [=id team=(set ship) hive=(set ship) met=data:meta]
  ::  $echo: number of times diff has been echoed
  ::
  +$  echo    @ud
  +$  diff    (pair echo delta)
  ::
  +$  delta    
    $%  [%writ =diff:writs]
        [%meta meta=data:meta]
        [%team =ship ok=?]
        [%hive by=ship for=ship add=?]
        [%init team=(set ship) hive=(set ship) met=data:meta]
    ==
  ::
  +$  action  (pair id diff)
  --
::
::  $writs: a set of time ordered chat messages
::
++  writs
  =<  writs
  |%
  +$  writs
    ((mop time writ) lte)
  ++  on
    ((^on time writ) lte)
  +$  diff
    (pair id delta)
  +$  delta
    $%  [%add p=memo]
        [%del ~]
        [%add-feel p=ship q=feel]
        [%del-feel p=ship]
    ==
  --
::
::  $dm: a direct line of communication between two ships
::
::    net: status of dm
::    id: a message identifier
::    action: an update to the dm
::    rsvp: a response to a dm invitation
::
++  dm
  =<  dm
  |%
  +$  dm
    $:  =pact
        =remark
        =net
        pin=_|
    ==
  +$  net     ?(%inviting %invited %archive %done)
  +$  id      (pair ship time)
  +$  diff    diff:writs
  +$  action  (pair ship diff)
  +$  rsvp    [=ship ok=?]
  --
::
::  $log: a time ordered map of all modifications to groups
::
+$  log
  ((mop time diff) lte)
++  log-on
  ((on time diff) lte)
+$  remark
  [last-read=time watching=_| ~]
::
::  $chat: a group based channel for communicating
::
+$  chat
  [=net =remark =log =perm =pact]
::
::  $notice: the contents of an automated message
::  
::    pfix: text preceding ship name
::    sfix: text following ship name
::
+$  notice  [pfix=@t sfix=@t]
::
::  $content: the contents of a message whether handwritten or automated
::
+$  content
  $%  [%story p=story]
      [%notice p=notice]
  ==
::
::  $draft: the contents of an unsent message at a particular $whom
::
+$  draft
  (pair whom story)
::
::  $story: handwritten contents of a message
::
::    blocks precede inline content
::
+$  story
  (pair (list block) (list inline))
::
::  $block: content which stands on it's own outside of inline content
::
+$  block
  $%  [%image src=cord height=@ud width=@ud alt=cord]
      [%cite =cite]
  ==
::
::  $inline: a representation of text with or without formatting
::
::    @t: plain text
::    %italics: italic text
::    %bold: bold text
::    %strike: strikethrough text
::    %blockquote: blockquote surrounded content
::    %inline-code: code formatting for small snippets
::    %ship: a mention of a ship
::    %block: link/reference to blocks
::    %code: code formatting for large snippets
::    %tag: tag gets special signifier
::    %link: link to a URL with a face
::    %break: line break
::
+$  inline
  $@  @t
  $%  [%italics p=(list inline)]
      [%bold p=(list inline)]
      [%strike p=(list inline)]
      [%blockquote p=(list inline)]
      [%inline-code p=cord]
      [%ship p=ship]
      [%block p=@ud q=cord]
      [%code p=cord]
      [%tag p=cord]
      [%link p=cord q=cord]
      [%break ~]
  ==
::
::  $memo: a chat message with metadata
::
::    replying: what message we're replying to
::    author: writer of the message
::    sent: time (from sender) when the message was sent
::    content: body of the message
::
+$  memo  
  $:  replying=(unit id)
      author=ship
      sent=time
      =content
  ==
::
::  $net: an indicator of whether I'm a host or subscriber
::
::    %load: iniating chat join
::    %pub: am publisher/host with fresh log
::    %sub: subscribed to the ship
::
+$  net
  $%  [%sub host=ship load=_| =saga:e]
      [%pub ~]
  ==
::
::  $action: the complete set of data required to edit a chat
::
+$  action
  (pair flag update)
::
::  $update: a representation in time of a modification of a chat
::
+$  update
  (pair time diff)
::
::  $logs: a time ordered map of all modifications to groups
::
+$  logs
  ((mop time diff) lte)
::
::  $perm: represents the permissions for a channel and gives a pointer
::  back to the group it belongs to.
::
+$  perm
  $:  writers=(set sect:g)
      group=flag:g
  ==
::  $join: a group + channel flag to join a channel, group required for perms
::
+$  join
  $:  group=flag:g
      chan=flag:g
  ==
::  $leave: a flag to pass for a channel leave
::
+$  leave  flag:g
::
::  $create: represents a request to create a channel
::    
::    The name will be used as part of the flag which represents the
::    channel. $create is consumed by the chat agent first 
::    and then passed to the groups agent to register the channel with 
::    the group. 
::  
::    Write permission is stored with the specific agent in the channel,
::    read permission is stored with the group's data.
::
+$  create
  $:  group=flag:g
      name=term
      title=cord
      description=cord
      readers=(set sect:g)
      writers=(set sect:g)
  ==
++  met     metadata-store
+$  club-import  [ships=(set ship) =association:met =graph:gra]
+$  club-imports  (map flag club-import)
::
+$  import  [writers=(set ship) =association:met =update-log:gra =graph:gra]
::
+$  imports  (map flag import)
::
++  gra  graph-store
++  orm-gra  orm:lib-graph
++  orm-log-gra  orm-log:lib-graph
--

/-  g=groups
/-  meta
|%
::  $writ: a chat message
+$  writ   [seal memo]
::  $id: an identifier for chat messages
+$  id     (pair ship time)
::  $feel: either an emoji identifier like :wave: or a URL for custom
+$  feel   @ta
::
::  $seal: the id of a chat and its meta-responses
::
+$  seal
  $:  =id
      feels=(map ship feel)   :: reactions to a message
      replied=(set id)        :: replies to a message
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
++  briefs
  =<  briefs
  |% 
  +$  briefs
    (map whom brief)
  ::  $brief: the last time a message was read, how many messages since,
  ::  and the id of the last read message
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
+$  diff
  $%  [%writs p=diff:writs]         :: a chat message update
    ::
      [%add-sects p=(set sect:g)]   :: add sects to writer permissions
      [%del-sects p=(set sect:g)]   :: delete sects from writers
    ::
      [%create p=perm]
  ==
::  $index: a map of chat message id to server received message time
+$  index   (map id time)
::
::  $pact: a double indexed map of chat messages, id -> time -> message
::
+$  pact
  $:  wit=writs
      dex=index
  ==
::
::  $club: a direct line of communication between multiple parties, uses
::  gossip to ensure all parties keep in sync
::
++  club
  =<  club
  |%
  ::  $id: an identification signifier for a $club
  +$  id  @uvH
  ::  $net: status of $club
  +$  net  ?(%archive %invited %done)
  +$  club  [=pact crew]
  ::
  +$  crew
    $:  team=(set ship)   :: members that have accepted an invite
        hive=(set ship)   :: pending members that have been invited
        met=data:meta     :: metadata representing club
        =net              :: status
        pin=_|            :: should the $club be pinned to the top
    ==
  ::  $rsvp: a $club invitation response
  ::
  +$  rsvp    [=id =ship ok=?]
  ::  $create: a request to create a $club with a starting set of ships
  +$  create
    [=id hive=(set ship)]
  ::  $invite: the contents to send in an invitation to someone
  +$  invite  [=id team=(set ship) hive=(set ship) met=data:meta]
  +$  echo    @ud  :: number of times diff has been echoed
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
    $%  [%add p=memo]               :: add message
        [%del ~]                    :: delete message
        [%add-feel p=ship q=feel]   :: add reaction to message
        [%del-feel p=ship]          :: delete reaction
    ==
  --
::
::  $dm: a direct line of communication between two ships
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
  ::  $net: status of dm
  +$  net     ?(%inviting %invited %archive %done)
  ::  $id: a message identifier
  +$  id      (pair ship time)
  +$  diff    diff:writs
  ::  $action: an update to the $dm
  +$  action  (pair ship diff)
  ::  $rsvp: a response to a $dm invitation
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
+$  story
  (pair (list block) (list inline))   :: blocks precede inline content
::
::  $block: content which stands on it's own outside of inline content
::
+$  block
  $%  [%image src=cord height=@ud width=@ud alt=cord] :: an image
  ==
::
::  $inline: a representation of text with or without formatting
::
+$  inline
  $@  @t                              :: plain text
  $%  [%italics p=inline]             :: italic text
      [%bold p=inline]                :: bold text
      [%strike p=inline]              :: strikethrough text
      [%inline-code p=cord]           :: code formatting for small snippets
      [%blockquote p=(list inline)]   :: blockquote surrounded content
      [%block p=@ud q=cord]           :: link/reference to blocks
      [%code p=cord]                  :: code formatting for large snippets
      [%tag p=cord]                   :: tag gets special signifier
      [%link p=cord q=cord]           :: link to a URL with a face
      [%break ~]                      :: line break
  ==
::
::  $memo: a chat message with metadata
::
+$  memo  
  $:  replying=(unit id)  :: what message we're replying to
      author=ship         :: author of the message
      sent=time           :: time (from sender) when the message was sent 
      =content            :: contents of the message
  ==
::
::  $net: an indicator of whether I'm a host or subscriber
::
+$  net
  $~  [%load ~]
  $%  [%sub p=ship]   :: subscribed to the ship
      [%pub ~]        :: am publisher/host with fresh log
      [%load ~]       :: iniating chat join
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
::
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
--

/-  graph-store
/-  cite
/-  g=groups, e=epic
/-  metadata-store
/+  lib-graph=graph-store
|%
::  $flag: identifier for a heap channel
+$  flag  (pair ship term)
::  $feel: either an emoji identifier like :wave or a URL for custom
+$  feel  @ta
::  $view: the persisted display format for a heap
+$  view  ?(%grid %list)
::  $stash: heaps I've joined
+$  stash  (map flag heap)
::  $said: used for curio references
+$  said  (pair flag curio)
::
::  $heap: a collection of curiosities
::
::    net: an indicator of whether I'm a host or subscriber
::    log: the history of all modifications
::    perm: holds the heap's permissions
::    view: what format to display
::    curios: the actual contents of the heap
::    remark: what is the last thing we've seen/read
::
+$  heap
  $:  =net
      =log
      =perm
      =view
      =curios
      =remark
  ==
::  $curios: a set of time ordered heap items
::
++  curios
  =<  curios
  |%
  +$  curios
    ((mop time curio) lte)
  ++  on
    ((^on time curio) lte)
  +$  diff
    (pair time delta)
  +$  delta
    $%  [%add p=heart]
        [%edit p=heart]
        [%del ~]
        [%add-feel p=ship q=feel]
        [%del-feel p=ship]
    ==
  --
::  $curio: an item in the collection or a comment about an item
::
+$  curio  [seal heart]
::
::  $seal: the id of a curio and its meta-responses
::
::    time: the id of the curio
::    feels: reactions to a curio
::    replied: set of replies to a curio
::
+$  seal
  $:  =time
      feels=(map ship feel)
      replied=(set time)
  ==
::  $heart: the curio data itself
::
::    title: name of the curio
::    content: body of the curio
::    author: writer of the curio
::    sent: the client-side time the curio was made
::    replying: what curio we're commenting on
::
+$  heart
  $:  title=(unit @t)
      =content
      author=ship
      sent=time
      replying=(unit time)
  ==
::  $content: curio content
::
+$  content
  (pair (list block) (list inline))
::  $block: block-level curio content
+$  block
  $%  [%image src=cord height=@ud width=@ud alt=cord]
      [%cite =cite]
  ==
::  $inline: curio content that flows within a paragraph
::
::    @t: plain text
::    %italics: italic text
::    %bold: bold text
::    %strike: strikethrough text
::    %inline-code: code formatting for small snippets
::    %blockquote: blockquote surrounded content
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
      [%code p=cord]
      [%block p=@ud q=cord]
      [%tag p=cord]
      [%link p=cord q=cord]
      [%break ~]
  ==
::  $log: a time ordered history of modifications to a heap
::
+$  log
  ((mop time diff) lte)
++  log-on
  ((on time diff) lte)
::
::  $action: the complete set of data required to modify a heap
::
+$  action
  (pair flag:g update)
::
::  $update: a representation in time of a modification to a heap
::
+$  update
  (pair time diff)
::
::  $diff: the full suite of modifications that can be made to a heap
::
+$  diff
  $%  [%curios p=diff:curios]
    ::
      [%add-sects p=(set sect:g)]
      [%del-sects p=(set sect:g)]
    ::
      [%create p=perm q=curios]
      [%view p=view]
  ==
::  $net: an indicator of whether I'm a host or subscriber
::
::    %pub: am publisher/host with fresh log
::    %sub: subscribed to the ship
::
+$  net
  $%  [%sub p=ship load=_| =saga:e]
      [%pub ~]
  ==
::
::  $briefs: a map of heap unread information
::
::    brief: the last time a heap was read, how many items since,
::    and the id of the last seen curio
::
++  briefs
  =<  briefs
  |% 
  +$  briefs
    (map flag brief)
  +$  brief
    [last=time count=@ud read-id=(unit time)]
  +$  update
    (pair flag brief)
  --
::  $remark: a marker representing the last note I've read
::
+$  remark
  [last-read=time watching=_| ~]
::
+$  remark-action
  (pair flag remark-diff)
::
+$  remark-diff
  $%  [%read ~]
      [%read-at p=time]
      [?(%watch %unwatch) ~]
  ==
::  $perm: represents the permissions for a heap channel and gives a
::  pointer back to the group it belongs to.
::
+$  perm
  $:  writers=(set sect:g)
      group=flag:g
  ==
::  $leave: a flag to pass for a channel leave
::
+$  leave  flag:g
::
::  $create: represents a request to create a channel
::    
::    The name will be used as part of the flag which represents the
::    channel. $create is consumed by the heap agent first and then
::    passed to the groups agent to register the channel with the group.
::  
::    Write permission is stored with the specific agent in the channel,
::    read permission is stored with the group's data.
::
+$  create
  $:  group=flag:g  :: TODO: unmanaged-style group chats
      name=term
      title=cord
      description=cord
      readers=(set sect:g)
      writers=(set sect:g)
  ==
::
++  met     metadata-store
::
+$  import  [writers=(set ship) =association:met =update-log:gra =graph:gra]
::
+$  imports  (map flag import)
::
++  gra  graph-store
++  orm-gra  orm:lib-graph
++  orm-log-gra  orm-log:lib-graph
--

/-  cite
/-  j=joint, g=groups, e=epic
/+  mp=mop-extensions
|%
+|  %ancients
::
++  okay  `epic:e`0
++  mar
  |%
  ++  act  `mark`%heap-action
  ++  upd  `mark`%heap-update
  ++  log  `mark`%heap-logs
  --
::
+|  %primitives
::
::  $stash: heaps I've joined
+$  stash  (map flag heap)
::
::  $heap: a collection of curiosities
::
::    curios: the actual contents of the heap
::    view: what format to display
::    perm: holds the heap's permissions
::    net: an indicator of whether I'm a host or subscriber
::    log: the history of all modifications
::    remark: what is the last thing we've seen/read
::
++  heap
  |^  ,[global local]
  +$  global
    $:  =curios
        view=(rev:j =view)
        perm=(rev:j =perm)
    ==
  ::
  +$  local
    $:  =net
        =log
        =remark
    ==
  --
::  $curio: an item in the collection or a comment about an item
::
+$  curio      [seal heart]
+$  id-curio   time
+$  curios     ((mop id-curio (unit curio)) lte)
++  on-curios  ((on id-curio (unit curio)) lte)
++  mo-notes   ((mp id-curio (unit curio)) lte)
::
::  $seal: the id of a curio and its meta-responses
::
::    time: the id of the curio
::    feels: reactions to a curio
::    replied: set of replies to a curio
::
+$  seal
  $:  id=id-curio
      =feels:j
      replied=(set id-curio)
  ==
::
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
      replying=(unit id-curio)
  ==
::
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
::
::  $flag: identifier for a heap channel
+$  flag  (pair ship term)
::  $view: the persisted display format for a heap
+$  view  ?(%grid %list)
::  $said: used for curio references
+$  said  (pair flag curio)
::
::  $net: subscriber-only state
::
+$  net  [load=_| =saga:e]
::
::  $briefs: a map of heap unread information
::
::    brief: the last time a heap was read, how many items since,
::    and the id of the last seen curio
::
+$  briefs  (map flag brief)
+$  brief   [last=time count=@ud read-id=(unit time)]
::
::  $remark: a marker representing the last note I've read
::
+$  remark  [last-read=time watching=_| ~]
::
::  $perm: represents the permissions for a heap channel and gives a
::  pointer back to the group it belongs to.
::
+$  perm
  $:  writers=(set sect:g)
      group=flag:g
  ==
::
::  $log: a time ordered history of modifications to a heap
::
+$  log     ((mop time u-heap) lte)
++  log-on  ((on time u-heap) lte)
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
+$  create-heap
  $:  group=flag:g  :: TODO: unmanaged-style group chats
      name=term
      title=cord
      description=cord
      readers=(set sect:g)
      writers=(set sect:g)
  ==
::
+|  %actions
::
+$  a-stash
  $%  [%create =create-heap]
      [%heap =flag =a-heap]
  ==
::
+$  a-heap
  $%  [%join group=flag:g]
      [%leave ~]
      a-remark:j
      c-heap
  ==
::
+$  a-curio  c-curio
::
+|  %commands
::
+$  c-stash
  $%  [%create =create-heap]
      [%heap =flag =c-heap]
  ==
::
+$  c-heap
  $%  [%curio =c-curio]
      [%view =view]
      [%add-writers sects=(set sect:g)]
      [%del-writers sects=(set sect:g)]
  ==
::
+$  c-curio
  $%  [%add =heart]
      [%edit id=id-curio =heart]
      [%del id=id-curio]
      c-feel:j
  ==
::
+|  %updates
::
+$  update   [=time =u-stash]
+$  u-stash  [=flag =u-heap]
+$  u-heap
  $%  [%create =perm]
      [%view (rev:j =view)]
      [%perm (rev:j =perm)]
      [%curio id=id-curio =u-curio]
  ==
::
+$  u-curio
  $%  [%set curio=(unit curio)]
      [%feels =feels:j]
      [%heart (rev:j =heart)]
  ==
::
+$  u-checkpoint  global:heap
::
+|  %responses
::
+$  r-stash  [=flag =r-heap]
+$  r-heap
  $%  [%curios =rr-curios]
      [%curio id=id-curio =r-curio]
      [%view =view]
      [%perm =perm]
    ::
      [%create =perm]
      [%join group=flag:g]
      [%leave ~]
      a-remark:j
  ==
::
+$  r-curio
  $%  [%set curio=(unit rr-curio)]
      [%feels =rr-feels:j]
      [%heart =heart]
  ==
::  versions of backend types with their revision numbers stripped,
::  because the frontend shouldn't care to learn those.
::
+$  rr-stash  (map flag rr-heap)
++  rr-heap
  |^  ,[global local]
  +$  global
    $:  curios=rr-curios
        =view
        =perm
    ==
  ::
  +$  local
    $:  =net
        =remark
    ==
  --
+$  rr-curios  ((mop id-curio (unit rr-curio)) lte)
+$  rr-curio   [rr-seal heart]
+$  rr-seal    [id=id-curio =rr-feels:j replied=(set id-curio)]
++  rr-on-curios  ((on id-curio (unit rr-curio)) lte)
--

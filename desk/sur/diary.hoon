/-  g=groups, c=cite, graph-store, e=epic
/-  metadata-store
/+  lib-graph=graph-store
|%
::  $flag: identifier for a diary channel
+$  flag  (pair ship term)
::  $feel: either an emoji identifier like :diff or a URL for custom
+$  feel  @ta
::  $view: the persisted display format for a diary
+$  view  ?(%grid %list)
::  $sort: the persisted sort type for a diary
+$  sort  ?(%alpha %time)
::  $shelf: my ship's diaries
+$  shelf  (map flag diary)
::  $said: used for references
+$  said  (pair flag outline)
::  $plan: index into diary state
::    p: Note being referred to
::    q: Quip being referred to, if any
::    
+$  plan
  (pair time (unit time))
::
::  $diary: written longform communication
::
::    net: an indicator of whether I'm a host or subscriber
::    log: the history of all modifications
::    perm: holds the diary's permissions
::    view: what format to display
::    sort: how to order posts
::    notes: the actual contents of the diary
::    remark: what is the last thing we've read
::    banter: comments organized by post
::
+$  diary
  $:  =net
      =log
      =perm
      =view
      =sort
      =notes
      =remark
  ==
::
::  $notes: a set of time ordered diary posts
::
++  notes
  =<  rock
  |%
  +$  rock
    ((mop time note) lte)
  ++  on
    ((^on time note) lte)
  +$  diff
    (pair time delta)
  +$  delta
    $%  [%add p=essay]
        [%edit p=essay]
        [%del ~]
        [%quips p=diff:quips]
        [%add-feel p=ship q=feel]
        [%del-feel p=ship]
    ==
  --
::
::  $quips: a set of time ordered note comments
::
++  quips
  =<  rock
  |%
  +$  rock
    ((mop time quip) lte)
  ++  on
    ((^on time quip) lte)
  +$  diff
    (pair time delta)
  +$  delta
    $%  [%add p=memo]
        [%del ~]
        [%add-feel p=ship q=feel]
        [%del-feel p=ship]
    ==
  --
::
::  $outline: abridged $note
::    .quips: number of comments
::
+$  outline
  [quips=@ud quippers=(set ship) essay]
::
++  outlines
  =<  outlines
  |%
  +$  outlines  ((mop time outline) lte)
  ++  on        ((^on time outline) lte)
  --
::
::  $note: a diary post
::
+$  note  [seal essay]
::  $quip: a post comment
::
+$  quip  [cork memo]
::
::  $seal: host-side data for a note
::
+$  seal
  $:  =time
      =quips
      feels=(map ship feel)
  ==
::
::  $cork: host-side data for a quip
::
+$  cork
  $:  =time
      feels=(map ship feel)
  ==
::  $essay: the post data itself
::
::    title: the name of the post
::    image: a visual displayed as a header
::    content: the body of the post
::    author: the ship that wrote the post
::    sent: the client-side time the post was made
::
+$  essay
  $:  title=@t
      image=@t
      content=(list verse)
      author=ship
      sent=time      
  ==
+$  story  (pair (list block) (list inline))
::  $memo: the comment data itself
::
::    content: the body of the comment
::    author: the ship that wrote the comment
::    sent: the client-side time the comment was made
::
+$  memo
  $:  content=story
      author=ship
      sent=time
  ==
::  $verse: a chunk of post content
::
::    blocks stand on their own. inlines come in groups and get wrapped
::    into a paragraph
::
+$  verse  
  $%  [%block p=block]
      [%inline p=(list inline)]
  ==
::  $listing: recursive type for infinitely nested <ul> or <ol>
+$  listing
  $%  [%list p=?(%ordered %unordered) q=(list listing) r=(list inline)]
      [%item p=(list inline)]
  ==
::  $block: post content that sits outside of the normal text
::
::    %image: a visual, we record dimensions for better rendering
::    %cite: an Urbit reference
::    %header: a traditional HTML heading, h1-h6
::    %listing: a traditional HTML list, ul and ol
::
+$  block
  $%  [%image src=cord height=@ud width=@ud alt=cord]
      [%cite =cite:c]
      [%header p=?(%h1 %h2 %h3 %h4 %h5 %h6) q=(list inline)]
      [%listing p=listing]
      [%rule ~]
  ==
::  $inline: post content that flows within a paragraph
::
::    @t: plain text
::    %italics: italic text
::    %bold: bold text
::    %strike: strikethrough text
::    %inline-code: code formatting for small snippets
::    %blockquote: blockquote surrounded content
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
::  $log: a time ordered history of modifications to a diary
::
+$  log
  ((mop time diff) lte)
++  log-on
  ((on time diff) lte)
::
::  $action: the complete set of data required to modify a diary
::
+$  action
  (pair flag:g update)
::
::  $update: a representation in time of a modification to a diary
::
+$  update
  (pair time diff)
::
::  $diff: the full suite of modifications that can be made to a diary
::
+$  diff
  $%  [%notes p=diff:notes]
    ::
      [%add-sects p=(set sect:g)]
      [%del-sects p=(set sect:g)]
    ::
      [%create p=perm q=notes]
      [%view p=view]
      [%sort p=sort]
    ::
  ==
::
::  $net: an indicator of whether I'm a host or subscriber
::
::    %pub: am publisher/host with fresh log
::    %sub: subscribed to the ship at saga
::
+$  net
  $%  [%sub p=ship load=_| =saga:e]
      [%pub ~] :: TODO: permissions?
  ==
::
::  $briefs: a map of diary unread information
::
::    brief: the last time a diary was read, how many posts since,
::    and the id of the last read note
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
::
::  $perm: represents the permissions for a diary channel and gives a
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
::    channel. $create is consumed by the diary agent first and then
::    passed to the groups agent to register the channel with the group.
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
+$  import  [writers=(set ship) =association:met =update-log:gra =graph:gra]
::
+$  imports  (map flag import)
::
++  gra  graph-store
++  orm-gra  orm:lib-graph
++  orm-log-gra  orm-log:lib-graph
++  met  metadata-store
--

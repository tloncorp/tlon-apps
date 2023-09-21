::  channels: message stream structures
::
::    four shapes that cross client-subscriber-publisher boundaries:
::    - actions    client-to-subscriber change requests (user actions)
::    - commands   subscriber-to-publisher change requests
::    - updates    publisher-to-subscriber change notifications
::    - responses  subscriber-to-client change notifications
::
::        --action-->     --command-->
::    client       subscriber       publisher
::      <--response--     <--update--
::
::    local actions _may_ become responses,
::    remote actions become commands,
::    commands _may_ become updates,
::    updates _may_ become responses.
::
/-  g=groups, c=cite, e=epic
/-  zer=diary-0, uno=diary-1
/+  mp=mop-extensions
|%
+|  %ancients
::
++  old
  |%
  ++  zero  zer
  ++  one  uno
  --
::
++  okay  `epic:e`1
++  mar
  |%
  ++  act  `mark`%channel-action
  ++  cmd  `mark`%channel-command
  ++  upd  `mark`%channel-update
  ++  log  `mark`%channel-logs
  ++  not  `mark`%channel-notes
  --
::
+|  %primitives
::
+$  shelf  (map nest diary)
++  diary
  |^  ,[global local]
  ::  $global: should be identical between ships
  ::
  +$  global
    $:  =notes
        order=(rev order=arranged-notes)
        view=(rev =view)
        sort=(rev =sort)
        perm=(rev =perm)
    ==
  ::  $window: sparse set of time ranges
  ::
  ::TODO  populate this
  +$  window  (list [from=time to=time])
  ::  .window: time range for requested notes that we haven't received
  ::  .diffs: diffs for notes in the window, to apply on receipt
  ::
  +$  future
    [=window diffs=(jug id-note u-note)]
  ::  $local: local-only information
  ::
  +$  local
    $:  =net
        =log
        =remark
        =window
        =future
    ==
  --
::  $note: a diary post
::
+$  note      [seal (rev essay)]
+$  id-note   time
+$  notes     ((mop id-note (unit note)) lte)
++  on-notes  ((on id-note (unit note)) lte)
++  mo-notes  ((mp id-note (unit note)) lte)
::  $quip: a post comment
::
+$  quip      [cork memo]
+$  id-quip   time
+$  quips     ((mop id-quip (unit quip)) lte)
++  on-quips  ((on id-quip (unit quip)) lte)
++  mo-quips  ((mp time (unit quip)) lte)
::  $seal: host-side data for a note
::
+$  seal  $+  diary-seal
  $:  id=id-note
      =quips
      =feels
  ==
::  $cork: host-side data for a quip
::
+$  cork
  $:  id=id-quip
      =feels
  ==
::  $essay: top-level post, with metadata
::
+$  essay  [memo =han-data]
::  $quip-meta: metadata for all quips
+$  quip-meta
  $:  quip-count=@ud
      last-quippers=(set ship)
      last-quip=(unit time)
  ==
::  $han-data: metadata for a channel type's "post"
::
+$  han-data
  $%  [%diary title=@t image=@t]
      [%heap title=(unit @t)]
      [%chat kind=$@(~ [%notice ~])]
  ==
::  $memo: post data proper
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
::  $story: post body content
::
+$  story  (list verse)
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
  $%  [%list p=?(%ordered %unordered %tasklist) q=(list listing) r=(list inline)]
      [%item p=(list inline)]
  ==
::  $block: post content that sits outside of the normal text
::
::    %image: a visual, we record dimensions for better rendering
::    %cite: an Urbit reference
::    %header: a traditional HTML heading, h1-h6
::    %listing: a traditional HTML list, ul and ol
::    %code: a block of code
::
+$  block  $+  diary-block
  $%  [%image src=cord height=@ud width=@ud alt=cord]
      [%cite =cite:c]
      [%header p=?(%h1 %h2 %h3 %h4 %h5 %h6) q=(list inline)]
      [%listing p=listing]
      [%rule ~]
      [%code code=cord lang=cord]
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
+$  inline  $+  diary-inline
  $@  @t
  $%  [%italics p=(list inline)]
      [%bold p=(list inline)]
      [%strike p=(list inline)]
      [%blockquote p=(list inline)]
      [%inline-code p=cord]
      [%code p=cord]
      [%ship p=ship]
      [%block p=@ud q=cord]
      [%tag p=cord]
      [%link p=cord q=cord]
      [%task p=?(%.y %.n) q=(list inline)]
      [%break ~]
  ==
::
+$  han  ?(%diary %heap %chat)
::  $nest: identifier for a diary channel
+$  nest  [=han =ship name=term]
::  $view: the persisted display format for a diary
+$  view  $~(%list ?(%grid %list))
::  $sort: the persisted sort type for a diary
+$  sort  $~(%time ?(%alpha %time %arranged))
::  $arranged-notes: an array of noteIds
+$  arranged-notes  (unit (list time))
::  $feel: either an emoji identifier like :diff or a URL for custom
+$  feel  @ta
+$  feels  (map ship (rev (unit feel)))
::  $scan: search results
+$  scan  (list scan-result)
+$  scan-result
  $%  [%note =rr-note]
      [%quip =id-note =rr-quip]
  ==
::  $said: used for references
+$  said  (pair nest rr-note)
::  $plan: index into diary state
::    p: Note being referred to
::    q: Quip being referred to, if any
::
+$  plan
  (pair time (unit time))
::
::  $net: subscriber-only state
::
+$  net  [p=ship load=_| =saga:e]
::
::  $briefs: a map of diary unread information
::
::    brief: the last time a diary was read, how many posts since,
::    and the id of the last read note
::
+$  briefs  (map nest brief)
+$  brief   [last=time count=@ud read-id=(unit time)]
::  $remark: a marker representing the last note I've read
::
+$  remark  [last-read=time watching=_| ~]
::
::  $perm: represents the permissions for a diary channel and gives a
::  pointer back to the group it belongs to.
::
+$  perm
  $:  writers=(set sect:g)
      group=flag:g
  ==
::
::  $log: a time ordered history of modifications to a diary
::
+$  log     ((mop time u-diary) lte)
++  log-on  ((on time u-diary) lte)
::
::  $create-diary: represents a request to create a channel
::
::    $create-diary is consumed by the diary agent first and then
::    passed to the groups agent to register the channel with the group.
::
::    Write permission is stored with the specific agent in the channel,
::    read permission is stored with the group's data.
::
+$  create-diary
  $:  =han
      name=term
      group=flag:g
      title=cord
      description=cord
      readers=(set sect:g)
      writers=(set sect:g)
  ==
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
++  rev
  |$  [data]
  [rev=@ud data]
::
++  apply-rev
  |*  [old=(rev) new=(rev)]
  ^+  [changed=& old]
  ?:  (lth rev.old rev.new)
    &+new
  |+old
::
++  next-rev
  |*  [old=(rev) new=*]
  ^+  [changed=& old]
  ?:  =(+.old new)
    |+old
  &+old(rev +(rev.old), + new)
::
+|  %actions
::
::  some actions happen to be the same as commands, but this can freely
::  change
::
::NOTE  we might want to add a action-id=uuid to this eventually, threading
::      that through all the way, so that an $r-shelf may indicate what
::      originally caused it
+$  a-shelf
  $%  [%create =create-diary]
      [%pin pins=(list nest)]
      [%diary =nest =a-diary]
  ==
+$  a-diary
  $%  [%join group=flag:g]
      [%leave ~]
      a-remark
      c-diary
  ==
::
+$  a-remark
  $~  [%read ~]
  $%  [%read ~]
      [%read-at =time]
      [%watch ~]
      [%unwatch ~]
  ==
::
+$  a-note  c-note
+$  a-quip  c-quip
::
+|  %commands
::
+$  c-shelf
  $%  [%create =create-diary]
      [%diary =nest =c-diary]
  ==
+$  c-diary
  $%  [%note =c-note]
      [%view =view]
      [%sort =sort]
      [%order order=arranged-notes]
      [%add-writers sects=(set sect:g)]
      [%del-writers sects=(set sect:g)]
  ==
::
+$  c-note
  $%  [%add =essay]
      [%edit id=id-note =essay]
      [%del id=id-note]
      [%quip id=id-note =c-quip]
      c-feel
  ==
::
+$  c-quip
  $%  [%add =memo]
      [%del id=id-quip]
      c-feel
  ==
::
+$  c-feel
  $%  [%add-feel id=@da p=ship q=feel]
      [%del-feel id=@da p=ship]
  ==
::
+|  %updates
::
+$  update   [=time =u-diary]
+$  u-shelf  [=nest =u-diary]
+$  u-diary
  $%  [%create =perm]
      [%order (rev order=arranged-notes)]
      [%view (rev =view)]
      [%sort (rev =sort)]
      [%perm (rev =perm)]
      [%note id=id-note =u-note]
  ==
::
+$  u-note
  $%  [%set note=(unit note)]
      [%feels =feels]
      [%essay (rev =essay)]
      [%quip id=id-quip =u-quip]
  ==
::
+$  u-quip
  $%  [%set quip=(unit quip)]
      [%feels =feels]
  ==
::
+$  u-checkpoint  global:diary
::
+|  %responses
::
+$  r-shelf  [=nest =r-diary]
+$  r-diary
  $%  [%notes =rr-notes]
      [%note id=id-note =r-note]
      [%order order=arranged-notes]
      [%view =view]
      [%sort =sort]
      [%perm =perm]
    ::
      [%create =perm]
      [%join group=flag:g]
      [%leave ~]
      a-remark
  ==
::
+$  r-note
  $%  [%set note=(unit rr-note)]
      [%quip id=id-quip =quip-meta =r-quip]
      [%feels feels=rr-feels]
      [%essay =essay]
  ==
::
+$  r-quip
  $%  [%set quip=(unit rr-quip)]
      [%feels feels=rr-feels]
  ==
::  versions of backend types with their revision numbers stripped,
::  because the frontend shouldn't care to learn those.
::
+$  rr-shelf  (map nest rr-diary)
++  rr-diary
  |^  ,[global local]
  +$  global
    $:  notes=rr-notes
        order=arranged-notes
        =view
        =sort
        =perm
    ==
  ::
  +$  local
    $:  =net
        =remark
    ==
  --
+$  rr-notes  ((mop id-note (unit rr-note)) lte)
+$  rr-note   [rr-seal essay]
+$  rr-seal   
  $:  id=id-note
      =rr-feels
      =rr-quips
      =quip-meta
  ==
+$  rr-feels  (map ship feel)
+$  rr-quip   [rr-cork memo]
+$  rr-quips  ((mop id-quip rr-quip) lte)
+$  rr-cork   [id=id-quip =rr-feels]
++  rr-on-notes  ((on id-note (unit rr-note)) lte)
++  rr-on-quips  ((on id-quip rr-quip) lte)
--

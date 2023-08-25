::  diary: notebook structures
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
  ++  act  `mark`%diary-action
  ++  cmd  `mark`%diary-command
  ++  upd  `mark`%diary-update
  ++  log  `mark`%diary-logs
  --
::
+|  %primitives
::
+$  shelf  (map flag diary)
++  diary
  |^  ,[=global =local]
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
++  mo-notes  ((mp time (unit note)) lte)
::  $quip: a post comment
::
+$  quip      [cork memo]
+$  id-quip   time
+$  quips     ((mop id-quip (unit quip)) lte)
++  on-quips  ((on id-quip (unit quip)) lte)
++  mo-quips  ((mp time (unit quip)) lte)
::  $seal: host-side data for a note
::
+$  seal
  $:  =time
      =quips
      =feels
  ==
::  $cork: host-side data for a quip
::
+$  cork
  $:  =time
      =feels
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
::    %code: a block of code
::
+$  block
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
::  $flag: identifier for a diary channel
+$  flag  (pair ship term)
::  $feel: either an emoji identifier like :diff or a URL for custom
+$  feel  @ta
+$  feels  (map ship (rev (unit feel)))
::  $view: the persisted display format for a diary
+$  view  ?(%grid %list)
::  $sort: the persisted sort type for a diary
+$  sort  ?(%alpha %time %arranged)
::  $arranged-notes: an array of noteIds
+$  arranged-notes  (unit (list time))
::  $said: used for references
+$  said  (pair flag outline)
::  $plan: index into diary state
::    p: Note being referred to
::    q: Quip being referred to, if any
::
+$  plan
  (pair time (unit time))
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
::  $perm: represents the permissions for a diary channel and gives a
::  pointer back to the group it belongs to.
::
+$  perm
  $:  writers=(set sect:g)
      group=flag:g
  ==
::
++  rev
  |$  [data]
  [rev=@ud data]
::
++  apply-rev
  |*  [old=(rev) new=(rev)]
  ?:  (lth rev.old rev.new)
    new
  old
::
+|  %actions
::
+$  a-shelf  [=flag =a-diary]
+$  a-diary
  $%  [%create =create-diary]
      [%join group=flag:g]
      [%leave ~]
      [%read ~]
      [%read-at =time]
      [%watch ~]
      [%unwatch ~]
      c-diary
  ==
::
+$  a-note  c-note
+$  a-quip  c-quip
::
++  action-to-command  !!
::
+|  %commands
::
+$  c-shelf  [=flag =c-diary]
+$  c-diary
  $%  [%notes =c-note]
      [%view =view]
      [%sort =sort]
      [%order order=arranged-notes]
      [%add-writers sects=(set sect:g)]
      [%del-writers sects=(set sect:g)]
  ==
::
+$  c-note
  $%  [%add p=essay]
      [%edit id=id-note p=essay]
      [%del id=id-note]
      [%quips id=id-note =c-quip]  ::TODO  consider singular (and %note)
      [%add-feel id=id-note p=ship q=feel]
      [%del-feel id=id-note p=ship]
  ==
::
+$  c-quip
  $%  [%add p=memo]
      [%del id=id-quip]
      [%add-feel id=id-quip p=ship q=feel]
      [%del-feel id=id-quip p=ship]
  ==
::
++  command-to-update  !!
::
+|  %updates
::
+$  update   [=time =u-diary]
+$  u-shelf  [=flag =u-diary]
+$  u-diary
  $%  [%notes id=id-note =u-note]
      [%order (rev order=arranged-notes)]
      [%view (rev =view)]
      [%sort (rev =sort)]
      [%perm (rev =perm)]
  ==
::
+$  u-note
  $%  [%set note=(unit note)]
      [%quip id=id-quip =u-quip]
      [%feels =feels]
      [%essay (rev =essay)]
  ==
::
+$  u-quip
  $%  [%set quip=(unit quip)]
      [%feels =feels]
  ==
::
++  update-to-response  !!
::
+|  %responses
::
+$  r-shelf  [=flag =r-diary]
+$  r-diary
  $%  [%notes id=id-note =r-note]
      [%order order=arranged-notes]
      [%view =view]
      [%sort =sort]
      [%perm =perm]
    ::
      [%read ~]
      [%read-at =time]
      [%watch ~]
      [%unwatch ~]
  ==
::
+$  r-note
  $%  [%set note=(unit rr-note)]
      [%quip id=id-quip =r-quip]
      [%feels feels=(map ship feel)]
      [%essay =essay]
  ==
::
+$  r-quip
  $%  [%set quip=(unit rr-quip)]
      [%feels feels=(map ship feel)]
  ==
::  versions of backend types with their revision numbers stripped,
::  because the frontend shouldn't care to learn those.
::
+$  rr-shelf  (map flag rr-diary)
++  rr-diary
  |^  ,[global local]
  +$  global
    $:  notes=(map id-note rr-note)
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
+$  rr-note   [rr-seal essay]
+$  rr-seal   [=time =rr-quips feels=(map ship feel)]
+$  rr-quip   [rr-cork memo]
+$  rr-quips  ((mop id-quip rr-quip) lte)
+$  rr-cork   [=time feels=(map ship feel)]
++  rr-on-notes  ((on id-quip rr-note) lte)
++  rr-on-quips  ((on id-quip rr-quip) lte)
::
+|  %helper-types
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
  $:  group=flag:g
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
::
+$  remark-action
  $~  [%read ~]
  $>(?(%read %read-at %watch %unwatch) a-diary)
::
:::::::::::::::::::::::::::::TODO  deleteme
::
::
:: ++  apply-feels
::   |=  [old=feels new=feels]
::   ^-  feels
::   %-  (~(uno by old) new)
::   |=  [* a=(rev (unit feel)) b=(rev (unit feel))]
::   (apply-rev a b)
:: ::
:: ::
:: ++  diary
::   |^  !!
::   ::  $log: a time ordered history of modifications to a diary
::   ::
::   ++  apply-diff
::     |=  [=global =diff]
::     ^-  (each _global [id:notes diff:notes])
::     ?-    -.diff
::         %order  &+global(order (apply-rev order.global +.diff))
::         %view   &+global(view (apply-rev view.global +.diff))
::         %sort   &+global(sort (apply-rev sort.global +.diff))
::         %perm   &+global(perm (apply-rev perm.global +.diff))
::         %notes
::       =/  res  (apply-diff:notes notes.global +.diff)
::       ?~  res
::         |+[id.diff diff.diff]
::       &+global(notes u.res)
::     ==
::   --
:: ::
:: ::  $notes: a set of time ordered diary posts
:: ::
:: ++  notes
::   ++  apply-notes
::     |=  [old=rock new=rock]
::     ((uno:mo old new) apply-note)
::   ::
::   ++  apply-diff
::     |=  [old=rock =id =diff]
::     ^-  (unit rock)
::     ?:  ?=(%set -.diff)
::       :-  ~
::       %^  put:on  old  id
::       =/  old-note  (get:on old id)
::       ?~  old-note
::         note.diff
::       (apply-note id u.old-note note.diff)
::     ::
::     =/  old-note  (get:on old id)
::     ?~  old-note
::       ~
::     :-  ~
::     %^  put:on  old  id
::     ^-  (unit note)
::     ?~  u.old-note
::       ~
::     :-  ~
::     ?-  -.diff
::       %quip   `note`u.u.old-note(quips (apply-diff:quips quips.u.u.old-note +.diff))
::       %feels  `note`u.u.old-note(feels (apply-feels feels.u.u.old-note +.diff))
::       %essay  `note`u.u.old-note(+ (apply-rev +.u.u.old-note +.diff))
::     ==
::   ::
::   ++  apply-note
::     |=  [=id old=(unit note) new=(unit note)]
::     ^-  (unit note)
::     ?~  old  ~
::     ?~  new  ~
::     :-  ~
::     %=  u.old
::       quips  (apply-quips:quips quips.u.old quips.u.new)
::       feels  (apply-feels feels.u.old feels.u.new)
::       +      (apply-rev +.u.old +.u.new)
::     ==
::   --
:: ::
:: ::  $quips: a set of time ordered note comments
:: ::
:: ++  quips
::   =<  rock
::   |%

::   ++  apply-quips
::     |=  [old=rock new=rock]
::     ((uno:mo old new) apply-quip)
::   ::
::   ++  apply-diff
::     |=  [old=rock =id =diff]
::     ^-  rock
::     ?:  ?=(%set -.diff)
::       %^  put:on  old  id
::       =/  gotten  (get:on old id)
::       ?~  gotten  ~
::       (apply-quip id u.gotten quip.diff)
::     ::
::     =/  old-quip  (get:on old id)
::     ?~  old-quip
::       %-  (slog 'diary: received diff for unknown quip' ~)
::       old
::     ?~  u.old-quip
::       old
::     %^  put:on  old  id
::     `u.u.old-quip(feels (apply-feels feels.u.u.old-quip +.diff))
::   ::
::   ++  apply-quip
::     |=  [=id old=(unit quip) new=(unit quip)]
::     ^-  (unit quip)
::     ?~  old  ~
::     ?~  new  ~
::     :-  ~
::     %=  u.old
::       feels  (apply-feels feels.u.old feels.u.new)
::       +      +.u.new
::     ==
::   --
::
--

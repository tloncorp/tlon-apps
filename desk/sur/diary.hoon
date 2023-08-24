/-  g=groups, c=cite, e=epic
/-  zer=diary-0, uno=diary-1
|%
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
::  $flag: identifier for a diary channel
+$  flag  (pair ship term)
::  $feel: either an emoji identifier like :diff or a URL for custom
+$  feel  @ta
::  $view: the persisted display format for a diary
+$  view  ?(%grid %list)
::  $sort: the persisted sort type for a diary
+$  sort  ?(%alpha %time %arranged)
::  $arranged-notes: an array of noteIds
+$  arranged-notes  (unit (list time))
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
++  apply-feels
  |=  [old=feels new=feels]
  (~(uno by old) new apply-rev)
::
::
::  $diary: written longform communication
::
::    notes: the actual contents of the diary
::    order: a list of noteIds, used for manual sorting
::    view: what format to display
::    sort: how to order posts
::    perm: holds the diary's permissions
::    net: an indicator of whether I'm a host or subscriber
::    log: the history of all modifications
::    remark: what is the last thing we've read
::
++  diary
  |^  ,[=global =local]
  ::
  ::  $global: should be identical between ships
  ::
  +$  global
    $:  =notes
        order=(rev order=arranged-notes)
        view=(rev =view)
        sort=(rev =sort)
        perm=(rev =perm)
    ==
  ::
  ::  $window: sparse set of time ranges
  ::
  ::TODO  populate this
  +$  window  (list [from=time to=time])
  ::
  ::  .window: time range for requested notes that we haven't received
  ::  .diffs: diffs for notes in the window, to apply on receipt
  ::
  +$  future
    [=window diffs=(jug id:notes diff:notes)]
  ::
  ::  $local: local-only information
  ::
  +$  local
    $:  =net
        =log
        =remark
        =window
        =future
    ==
  ::
  ::  $diffs: can be applied to global
  ::
  +$  diffs  (list diff)
  +$  diff
    $%  [%notes =id:notes =diff:notes]
        [%order (rev order=arranged-notes)]
        [%view (rev =view)]
        [%sort (rev =sort)]
        [%perm (rev =perm)]
    ==
  ::
  ++  apply-diffs
    |=  [=global =diffs]
    ^-  [(list [id:notes diff:notes]) _global]
    ?~  diffs  [~ global]
    =^  hed  global
      ?-    -.i.diffs
          %order  [~ global(order (apply-rev order.global +.i.diffs))]
          %view   [~ global(view (apply-rev view.global +.i.diffs))]
          %sort   [~ global(sort (apply-rev sort.global +.i.diffs))]
          %perm   [~ global(perm (apply-rev perm.global +.i.diffs))]
          %notes
        =/  res  (apply-diff:notes notes.global +.i.diffs)
        ?~  res
          [[id.i.diffs diff.i.diffs]~ global]
        [~ global(notes u.res)]
      ==
    =^  tal  global  $(diffs t.diffs)
    [(weld hed tal) global]
  --
::
::  $notes: a set of time ordered diary posts
::
++  notes
  =<  rock
  |%
  +$  id  time
  +$  rock  ((mop id (unit note)) lte)
  ++  on    ((^on id (unit note)) lte)
  +$  command
    $%  [%add p=essay]
        [%edit =id:notes p=essay]
        [%del =id:notes]
        [%quips =id:notes =command:quips]
        [%add-feel =id:notes p=ship q=feel]
        [%del-feel =id:notes p=ship]
    ==
  ::
  +$  diff
    $%  [%set note=(unit note)]
        [%quip =id:quips =diff:quips]
        [%feels feels=(map ship (rev feel=(unit feel)))]
        [%essay (rev =essay)]
    ==
  ::
  ++  apply-notes
    |=  [old=notes new=notes]
    (uno:mpn old new apply-note)
  ::
  ++  apply-diff
    |=  [old=notes =id =diff]
    ^-  (unit notes)
    ?:  ?=(%set -.diff)
      :-  ~
      %^  put:on  old  id
      ?~  note.diff
        ~
      =/  old-note  (~(get by old) id)
      ?~  old-note
        note.diff
      `(apply-note old-note u.note.diff)
    ::
    =/  old-note  (~(get by old) id)
    ?~  old-note
      ~
    :-  ~
    %^  put:on  old  id
    :-  ~
    ?-  -.diff
      %quip   u.old-note(quips (apply-diff:quips quips.old-note +.diff))
      %feels  u.old-note(feels (apply-feels feels.old-note +.diff))
      %essay  u.old-note(+ (apply-rev essay.old-note +.diff))
    ==
  ::
  ++  apply-note
    |=  [old=note new=note]
    %=  old
      feels  (apply-feels feels.old feels.new)
      essay  (apply-rev +.old +.new)
      quips  (apply-quips quips.old quips.new)
    ==
  --
::
::  $quips: a set of time ordered note comments
::
++  quips
  =<  rock
  |%
  +$  id  time
  +$  rock  ((mop id (unit quip)) lte)
  ++  on    ((^on id (unit quip)) lte)
  +$  command  delta
  +$  delta
    $%  [%add p=memo]
        [%del =id:quips]
        [%add-feel =id:quips p=ship q=feel]
        [%del-feel =id:quips p=ship]
    ==
  +$  diff
    $%  [%set quip=(unit quip)]
        [%feels feels=(map ship (rev feel=(unit feel)))]
    ==
  ::
  ++  apply-quips
    (uno:mpn old new apply-note)
  ::
  ++  apply-diff
    |=  [old=quips =id =diff]
    ^-  (unit quips)
    ?:  ?=(%set -.diff)
      :-  ~
      %^  put:on  old  id
      ?~  quips.diff
        ~
      =/  old-quips  (~(get by old) id)
      ?~  old-quips
        quips.diff
      `(apply-quips old-quips u.quips.diff)
    ::
    =/  old-quip  (~(get by old) id)
    ?~  old-quip
      ~
    :-  ~
    %^  put:on  old  id
    `u.old-quip(feels (apply-feels feels.old-quip +.diff))
  ::
  ++  apply-quip
    |=  [old=note new=note]
    %=  old
      feels  (apply-feels feels.old feels.new)
      memo  (apply-rev +.old +.new)
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
+$  note  [seal (rev essay)]
::  $quip: a post comment
::
+$  quip  [cork memo]
::
::  $seal: host-side data for a note
::
+$  seal
  $:  =time
      =quips
      feels=(map ship (rev (unit feel)))
  ==
::
::  $cork: host-side data for a quip
::
+$  cork
  $:  =time
      feels=(map ship (rev (unit feel)))
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
::  $log: a time ordered history of modifications to a diary
::
+$  log
  ((mop time diff) lte)
++  log-on
  ((on time diff) lte)
::
+$  flag-action  [=flag =action]
::  $action: user action to/from local ship
::
+$  action
  $%  [%create =create]
      [%join group=flag:g]
      [%leave ~]
      [%read ~]
      [%read-at =time]
      [%watch ~]
      [%unwatch ~]
      command
  ==
::
+$  remark-action
  $~  [%read ~]
  $>(?(%read %read-at %watch %unwatch) action)
::
+$  flag-command  [=flag =command]
::  $command: change request sent between ships
::
+$  command
  $%  [%notes =command:notes]
      [%view =view]
      [%sort =sort]
      [%order order=arranged-notes]
      [%add-writers sects=(set sect:g)]
      [%del-writers sects=(set sect:g)]
  ==
::
::  $update: a representation in time of a modification to a diary
::
+$  update  [=time =diff]
::
::  $diff: the full suite of modifications that can be made to a diary
::
+$  diff  diffs:diary
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
::  $create: represents a request to create a channel
::
::    $create is consumed by the diary agent first and then
::    passed to the groups agent to register the channel with the group.
::
::    Write permission is stored with the specific agent in the channel,
::    read permission is stored with the group's data.
::
+$  create
  $:  group=flag:g
      title=cord
      description=cord
      readers=(set sect:g)
      writers=(set sect:g)
  ==
--

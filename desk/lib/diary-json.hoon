/-  d=diary
/-  meta
/+  cite=cite-json
|%
++  enjs
  =,  enjs:format
  |%
  ++  quips-diff
    |=  d=diff:quips:d
    %-  pairs
    :~  time/s/(scot %ud p.d)
        delta/(quips-delta q.d)
    ==
  ::
  ++  quips-delta
    |=  d=delta:quips:d
    %+  frond  -.d
    ?+  -.d  ~
      %add  (memo p.d)
      %del  ~
    ==
  ::
  ++  flag
    |=  f=flag:d
    ^-  json
    s/(rap 3 (scot %p p.f) '/' q.f ~)
  ::
  ++  ship
    |=  her=@p
    n+(rap 3 '"' (scot %p her) '"' ~)
  ::
  ++  briefs
    |=  bs=briefs:d
    %-  pairs
    %+  turn  ~(tap by bs)
    |=  [f=flag:d b=brief:briefs:d]
    [(rap 3 (scot %p p.f) '/' q.f ~) (brief b)]
  ::
  ++  brief-update
    |=  u=update:briefs:d
    %-  pairs
    :~  flag/(flag p.u)
        brief/(brief q.u)
    ==
  ::
  ++  brief
    |=  b=brief:briefs:d
    %-  pairs
    :~  last/(time last.b)
        count/(numb count.b)
        read-id/?~(read-id.b ~ (time u.read-id.b))
    ==
  ::
  ++  shelf
    |=  sh=shelf:d
    %-  pairs
    %+  turn  ~(tap by sh)
    |=  [f=flag:d di=diary:d]
    [(rap 3 (scot %p p.f) '/' q.f ~) (diary di)]
  ::
  ++  diary
    |=  di=diary:d
    %-  pairs
    :~  perms/(perm perm.di)
        view/s/view.di
        sort/s/sort.di
    ==
  ++  perm
    |=  p=perm:d
    %-  pairs
    :~  writers/a/(turn ~(tap in writers.p) (lead %s))
    ==
  ++  action
    |=  =action:d
    %-  pairs
    :~  flag/(flag p.action)
        update/(update q.action)
    ==
  ++  update
    |=  =update:d
    %-  pairs
    :~  time+s+(scot %ud p.update)
        diff+(diff q.update)
    ==
  ::
  ++  diff
    |=  =diff:d
    %+  frond  -.diff
    ?+  -.diff  ~
      %view       s/p.diff
      %sort       s/p.diff
      %notes     (notes-diff p.diff)
      %quips     (pairs id/s/(scot %ud p.diff) diff/(quips-diff q.diff) ~)
      %add-sects  a/(turn ~(tap in p.diff) (lead %s))
      %del-sects  a/(turn ~(tap in p.diff) (lead %s))
    ==
  ::
  ++  notes-diff
    |=  =diff:notes:d
    %-  pairs
    :~  time/s/(scot %ud p.diff)
        delta/(notes-delta q.diff)
    ==
  ::
  ++  notes-delta
    |=  =delta:notes:d
    %+  frond  -.delta
    ?+  -.delta  ~
      %add       (essay p.delta)
      %edit      (essay p.delta)
      %del       ~
      %add-feel  (add-feel +.delta)
    ==
  ::
  ++  essay
    |=  =essay:d
    %-  pairs
    :~  title/s/title.essay
        image/s/image.essay
        content/a/(turn content.essay verse)
        author+(ship author.essay)
        sent+(time sent.essay)
    ==
  ::
  ++  verse
    |=  =verse:d
    ^-  json
    %+  frond  -.verse
    ?-  -.verse
        %block  (block p.verse)
        %inline  a+(turn p.verse inline)
    ==
  ++  block
    |=  b=block:d
    ^-  json
    %+  frond  -.b
    ?-  -.b
        %cite  (enjs:cite cite.b)
        %image
      %-  pairs
      :~  src+s+src.b
          height+(numb height.b)
          width+(numb width.b)
          alt+s+alt.b
      ==
    ==
  ::
  ++  inline
    |=  i=inline:d
    ^-  json
    ?@  i  s+i
    %+  frond  -.i
    ?-  -.i
        %break
      ~
    ::
        ?(%code %tag %inline-code)
      s+p.i
    ::
        ?(%italics %bold %strike %blockquote)
      :-  %a
      (turn p.i inline)
    ::
        %block
      %-  pairs
      :~  index+(numb p.i)
          text+s+q.i
      ==
    ::
        %link
      %-  pairs
      :~  href+s+p.i
          content+s+q.i
      ==
    ==
  ::
  ++  add-feel
    |=  [her=@p =feel:d]
    %-  pairs
    :~  feel+s+feel
        ship+(ship her)
    ==
  ::
  ++  notes
    |=  =notes:d
    ^-  json
    %-  pairs
    %+  turn  (tap:on:notes:d notes)
    |=  [key=@da n=note:d]
    [(scot %ud key) (note n)]
  ::
  ++  quips
    |=  =quips:d
    ^-  json
    %-  pairs
    %+  turn  (tap:on:quips:d quips)
    |=  [key=@da q=quip:d]
    [(scot %ud key) (quip q)]
  ::
  ++  quip
    |=  q=quip:d
    ^-  json
    %-  pairs
    :~  seal+(seal -.q)
        memo+(memo +.q)
    ==
  ::
  ++  memo
    |=  m=memo:d
    ^-  json
    %-  pairs
    :~  replying/s/(scot %ud replying.m)
        content/a/(turn content.m inline)
        author/(ship author.m)
        sent/(time sent.m)
    ==
  ::
  ++  note
    |=  =note:d
    %-  pairs
    :~  seal+(seal -.note)
        essay+(essay +.note)
    ==
  ::
  ++  seal
    |=  =seal:d
    %-  pairs
    :~  time+(time time.seal)
    ::
        :-  %feels
        %-  pairs
        %+  turn  ~(tap by feels.seal)
        |=  [her=@p =feel:d]
        [(scot %p her) s+feel]
    ==
  ++  remark-action
    |=  act=remark-action:d
    %-  pairs
    :~  flag/(flag p.act)
        diff/(remark-diff q.act)
    ==
  ::
  ++  remark-diff
    |=  diff=remark-diff:d
    %+  frond  -.diff
    ~!  -.diff
    ?-  -.diff
      %read-at  (time p.diff)
      ?(%read %watch %unwatch)  ~
    ==
  ::
  --
++  dejs
  =,  dejs:format
  |%
  ++  ship  (su ;~(pfix sig fed:ag))
  ++  flag  `$-(json flag:d)`(su flag-rule)
  ++  flag-rule  ;~((glue fas) ;~(pfix sig fed:ag) sym)
  ++  create
    ^-  $-(json create:d)
    %-  ot
    :~  group+flag
        name+(se %tas)
        title+so
        description+so
        readers+(as (se %tas))
        writers+(as (se %tas))
    ==
  ++  action
    ^-  $-(json action:d)
    %-  ot
    :~  flag+flag
        update+update
    ==
  ::
  ++  update
    |=  j=json
    ^-  update:d
    ?>  ?=(%o -.j)
    [*time (diff (~(got by p.j) %diff))]
  ::
  ++  diff
    ^-  $-(json diff:d)
    %-  of
    :~  notes/notes-diff
        view/(su (perk %grid %list ~))
        sort/(su (perk %time %alpha ~))
        quips/(ot id/(se %ud) diff/quips-diff ~)
        add-sects/add-sects
        del-sects/del-sects
    ==
  ::
  ++  quips-diff
    %-  ot
    :~  time/(se %ud)
        delta/quips-delta
    ==
  ::
  ++  quips-delta
    %-  of
    :~  add/memo
        del/ul
        add-feel/add-feel
    ==
  ::
  ++  memo
    %-  ot
    :~  replying/(se %ud)
        content/(ar inline)
        author/(se %p)
        sent/di
    ==
  ::
  ++  notes-diff
    ^-  $-(json diff:notes:d)
    %-  ot
    :~  time/(se %ud)
        delta/notes-delta
    ==
  ++  notes-delta
    ^-  $-(json delta:notes:d)
    %-  of
    :~  add/essay
        edit/essay
        del/ul
        add-feel/add-feel
    ==
  ::
  ++  add-sects  (as (se %tas))
  ::
  ++  del-sects  (as (se %tas))
  ::
  ++  essay
    ^-  $-(json essay:d)
    %-  ot
    :~  title/so
        image/so
        content/(ar verse)
        author/ship
        sent/di
    ==
  ::
  ++  verse
    ^-  $-(json verse:d)
    %-  of
    :~  block/block
        inline/(ar inline)
    ==
  ::
  ++  block
    |=  j=json
    ^-  block:d
    %.  j
    %-  of
    :~  cite/dejs:cite
    ::
      :-  %image
      %-  ot
      :~  src/so
          height/ni
          width/ni
          alt/so
      ==
    ==
  ::
  ++  inline
    |=  j=json
    ^-  inline:d
    ?:  ?=([%s *] j)  p.j
    =>  .(j `json`j)
    %.  j
    %-  of
    :~  italics/(ar inline)
        bold/(ar inline)
        strike/(ar inline)
        blockquote/(ar inline)
        inline-code/so
        code/so
        tag/so
        break/ul
    ::
      :-  %block
      %-  ot
      :~  index/ni
          text/so
      ==
    ::
      :-  %link
      %-  ot
      :~  href/so
          content/so
      ==
    ==
  ::
  ++  add-feel
    %-  ot
    :~  ship/ship
        feel/so
    ==
  ::
  ++  remark-action
    %-  ot
    :~  flag/flag
        diff/remark-diff
    ==
  ::
  ++  remark-diff
    %-  of
    :~  read/ul
        watch/ul
        unwatch/ul
    ==
  --
--

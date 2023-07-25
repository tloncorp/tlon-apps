/-  *quorum
/+  nq=quorum-nectar
/+  n=nectar
|%
::
::  +parse: transform a quorum query string into a tokenized query
::
++  parse
  |=  input=@t
  ^-  (list token:query)
  %+  scan  (cass (trip input))
  %+  more  (plus ace)
  ;~  pose
      ;~  (glue col)
          (cold %author (jest 'author'))
          ;~  pfix
              sig
              %-  sear
              :_  crub:so
              |=([p=@ta q=@] ?:(=(p 'p') (some (scot %p q)) ~))
      ==  ==
      ;~((glue col) (cold %tag (jest 'tag')) sym)
      (stag %content (cook crip (plus ;~(less col ace qit))))
  ==
::
::  +apply: apply high-level action to board, returning result board
::
++  apply
  |=  [=board =bowl:gall =action]
  ^-  ^board
  =/  flag=flag   p.action
  =/  upd=update  q.action
  =/  add-post
    |=  [con=@t dad=(unit @ud) ted=(unit [hed=@t tag=(set term)])]
    ^-  (list query:n)
    :*  :*  %insert   %posts
            :_  ~
            :~  post-id=next-id.metadata.board
                parent-id=(fall dad 0)
                child-ids=[%s ~]
                votes=[%m ~]
                history=[%b (put:om-edits *edits now.bowl [src.bowl con])]
        ==  ==
        ?~  ted  ~
        :_  ~
        :*  %insert   %threads
            :_  ~
            :~  post-id=next-id.metadata.board
                child-ids=[%s ~]
                best-id=0
                title=hed.u.ted
                tags=[%s tag.u.ted]
    ==  ==  ==
  ?+    -.upd  !!
      %new-board
    ?>  (~(admin ok board(board.metadata flag) -.upd) src.bowl)
    :-  =,(upd [flag [(silt writers) group] title description (silt tags) 1])
    %+  applys:nq  database.board
    %+  turn  specs:table
    |=  =spec:table
    :+  %add-table  name.spec
    :*  schema=(make-schema:n schema.spec)
        primary-key=~[%post-id]
        indices=(make-indices:n [~[%post-id] primary=& autoincrement=~ unique=& clustered=|]~)
        records=~
    ==
  ::
      %edit-board
    ?>  (~(admin ok board -.upd) src.bowl)
    :_  database.board
    %=    metadata.board
        title
      (fall title.upd title.metadata.board)
    ::
        description
      (fall description.upd description.metadata.board)
    ::
        allowed-tags
      (fall (bind tags.upd silt) allowed-tags.metadata.board)
    ::
      ::  TODO: Implement editing for groups (i.e. migration of
      ::  group used for permissions)
      ::    group
      ::  (fall group.upd group.metadata.board)
    ==
  ::
      %new-thread
    =/  tagset=(set term)  (silt tags.upd)
    ?>  (~(tags ok board -.upd) tagset)
    :-  metadata.board(next-id +(next-id.metadata.board))
    %+  applys:nq  database.board
    (add-post content.upd ~ `[title.upd tagset])
  ::
      %edit-thread
    =/  tagset=(set term)  (silt (fall tags.upd *(list term)))
    ?>  (~(writer ok board -.upd) src.bowl post-id.upd)
    ?>  (~(tags ok board -.upd) tagset)
    ?>  ?|  =(~ best-id.upd)
            (~(response ok board -.upd) (need best-id.upd) post-id.upd)
        ==
    :-  metadata.board
    %+  apply:nq  database.board
    :*  %update  %threads  [%s %post-id %& %eq post-id.upd]
        ^-  (list [=term func=mod-func:n])
        :~  [%title |=(v=value:n (fall title.upd v))]
            [%tags |=(v=value:n (fall (bind tags.upd |=(* [%s tagset])) v))]
            [%best-id |=(v=value:n (fall (bind best-id.upd |=(b=@ud ?:(=(b v) 0 b))) v))]
    ==  ==
  ::
      %new-reply
    ::  FIXME: Annoying, but do this in case this is a comment;
    ::  otherwise, we won't check if the parent actually exists.
    =/  parent-post=post   (~(entry via board) %posts parent-id.upd)
    =/  parent-table=term  ?:(is-comment.upd %posts %threads)
    ?<  is-comment.upd  ::  TODO: Remove after comments are supported on the FE
    ?>  |(is-comment.upd (~(replier ok board -.upd) src.bowl parent-id.upd))
    :-  metadata.board(next-id +(next-id.metadata.board))
    %+  applys:nq  database.board
    %+  weld  (add-post content.upd `parent-id.upd ~)
    ^-  (list query:n)
    :~  :*  %update  parent-table  [%s %post-id %& %eq parent-id.upd]
            :~  :-  %child-ids
                |=  child-ids=value:n
                ^-  value:n
                ?>  ?=(%s -.child-ids)
                [%s (~(put in p.child-ids) next-id.metadata.board)]
    ==  ==  ==
  ::
      %edit-post
    ?>  (~(writer ok board -.upd) src.bowl post-id.upd)
    :-  metadata.board
    %+  apply:nq  database.board
    :*  %update  %posts  [%s %post-id %& %eq post-id.upd]
        :~  :-  %history
            |=  history=value:n
            ^-  value:n
            ?>  ?=([%b *] history)
            [%b (put:om-edits ;;(edits p.history) now.bowl [src.bowl content.upd])]
    ==  ==
  ::
      %delete-post
    ?>  (~(writer ok board -.upd) src.bowl post-id.upd)
    =/  dids=(set @)
      =/  desc=(list post)  (~(descendants via board) post-id.upd)
      (silt (turn desc |=(=post post-id.post)))
    =/  dady=(unit post)
      =/  ance=(list post)  (~(ancestors via board) post-id.upd)
      ?:((lth (lent ance) 2) ~ `(snag (sub (lent ance) 2) ance))
    :-  metadata.board
    %+  applys:nq  database.board
    ^-  (list query:n)
    :*  [%delete %threads %s %post-id %& %eq post-id.upd]
        [%delete %posts %s %post-id %| |=(v=value:n ?>(?=(@ v) (~(has in dids) v)))]
        ?~  dady  ~
        %+  turn  specs:table
        |=  =spec:table
        :*  %update  name.spec  [%s %post-id %& %eq post-id.u.dady]
            :*  :-  %child-ids
                |=  child-ids=value:n
                ^-  value:n
                ?>  ?=([%s *] child-ids)
                [%s (~(del in p.child-ids) post-id.upd)]
                ?:  =(name.spec %posts)  ~
                :_  ~
                [%best-id |=(v=value:n ?:(=(v post-id.upd) 0 v))]
    ==  ==  ==
  ::
      %vote
    :-  metadata.board
    %+  apply:nq  database.board
    :*  %update  %posts  [%s %post-id %& %eq post-id.upd]
        :~  :-  %votes
            |=  votes=value:n
            ^-  value:n
            ?>  ?=(%m -.votes)
            :-  %m
            =/  src-vote  (~(get by p.votes) src.bowl)
            ?^  src-vote
              ?:  =(u.src-vote dir.upd)
                (~(del by p.votes) src.bowl)        :: if same vote exists, remove
              (~(put by p.votes) src.bowl dir.upd)  :: if diff vote exists, change
            (~(put by p.votes) src.bowl dir.upd)    :: if no vote, insert
    ==  ==
  ::
      %add-sects
    :_  database.board
    %=    metadata.board
        writers.perm
      (~(uni in writers.perm.metadata.board) (silt sects.upd))
    ==
  ::
      %del-sects
    :_  database.board
    %=    metadata.board
        writers.perm
      (~(dif in writers.perm.metadata.board) (silt sects.upd))
    ==
  ==
::
::  +poast: helper functions for post types
::
++  poast
  |%
  ::
  ++  author
    |=  =post
    ^-  @p
    =/  edit=(unit [* author=@p *])  (ram:om-edits history.post)
    author:(need edit)
  ::
  ++  authors
    |=  =post
    ^-  (set @p)
    =<  -
    %^    (dip:om-edits (set @p))
        history.post
      *(set @p)
    |=  [s=(set @p) k=@da v=[@p @t]]
    [`v %.n (~(put in s) -.v)]
  ::
  ++  best
    |=  =post
    ^-  (unit @)
    %-  fall
    :_  ~
    %+  bind  thread.post
    |=(m=thread-meta ?:(=(0 best-id.m) ~ `best-id.m))
  ++  content
    |=  =post
    ^-  @t
    =/  edit=[[* * content=@t] *]  (pop:om-edits history.post)
    content:edit
  ::
  ++  act-date
    |=  =post
    ^-  @da
    =/  edit=[[date=@da * *] *]  (pop:om-edits history.post)
    date:edit
  ++  pub-date
    |=  =post
    ^-  @da
    =/  edit=(unit [date=@da * *])  (ram:om-edits history.post)
    date:(need edit)
  ::
  ++  replies
    |=  =post
    ^-  (set @)
    replies:(fall thread.post *thread-meta)
  ::
  ++  score
    |=  =post
    ^-  @sd
    =<  -
    %+  ~(rib by votes.post)  --0
    |=  [[k=@p v=vote] a=@sd]
    :_  [k v]
    (sum:si a ?:(=(v %up) --1 -1))
  ::
  ++  sort
    |=  [specs=(lest spec:order) posts=(list post)]
    ^-  (list post)
    %+  ^sort  posts
    |=  [a=post b=post]
    ^-  @f
    =<  =(+ --1)
    %^  spin  `(list spec:order)`specs  --0
    |=  [=spec:order status=@sd]
    :-  spec
    ?:  !=(status --0)  status
    =-  (pro:si - ?:(desc.spec --1 -1))
    ?-    param.spec
        %score
      (cmp:si (score a) (score b))
    ::
        %act-date
      (cmp:si (new:si %& (act-date a)) (new:si %& (act-date b)))
    ::
        %pub-date
      (cmp:si (new:si %& (pub-date a)) (new:si %& (pub-date b)))
    ::
        %best
      =/  bcmp  |=(p=post (fall (bind (best p) |=(i=@ --1)) --0))
      (cmp:si (bcmp a) (bcmp b))
    ==
  --
::
::  +ok: assert board action for validity with respect to
::  permissions, correctness, etc.
::
::    TODO: Add standard info on source board to each error message
::    TODO: Improve formatting for error messages
::
++  ok
  |_  [board act=@t]
  ::
  ++  admin
    |=  who=@p
    ~|  "%quorum: user {<who>} can't {<act>} for board {<board.metadata>}"
    ?>  =(who p.board.metadata)
    %.y
  ::
  ++  writer
    |=  [who=@p pid=@ud]
    =/  post=post  (~(entry via [metadata database]) %posts pid)
    ~|  "%quorum: user {<who>} can't write via {<act>} for post-{<pid>}"
    ?>  |(=(who p.board.metadata) =(who (author:poast post)))
    %.y
  ::
  ++  replier
    |=  [who=@p pid=@ud]
    =*  bod  [metadata database]
    =/  post=post  (~(entry via bod) %threads pid)
    ::  FIXME: This could use a bit of refactoring
    =-  ~|  "%quorum: user {<who>} can't reply via {<act>} for post-{<pid>}"
        ?>  =(~ replies)
        %.y
    ^=  replies
    %+  ~(dump via bod)  %posts
    %-  some
    :+  %and
      :*  %s  %post-id  %|
          |=  v=value:n
          ?>  ?=(@ v)
          (~(has in replies:(need thread.post)) v)
      ==
    :*  %s  %history  %|
        |=  v=value:n
        ?>  ?=([%b *] v)
        =/  vpos=^post  =+(p=*^post p(history ;;(edits p.v)))
        =(who (author:poast vpos))
    ==
  ::
  ++  response
    |=  [pid=@ud tid=@ud]
    =/  post=post  (~(entry via [metadata database]) %threads tid)
    ~|  "%quorum: can't {<act>} because post-{<pid>} isn't a response to post-{<tid>}"
    ?>  (~(has in (replies:poast post)) pid)
    %.y
  ::
  ++  tags
    |=  tags=(set term)
    =/  bads=(set term)  (~(dif in tags) allowed-tags.metadata)
    ~|  "%quorum: can't {<act>} with invalid tags {<bads>}"
    ?>  |(=(0 ~(wyt in allowed-tags.metadata)) =(0 ~(wyt in bads)))
    %.y
  --
::
::  +via: perform low-level board operation
::
++  via
  |_  board
  ::
  ::  +threads: get all threads within a board
  ::
  ++  threads
    |-
    ^-  (list post)
    (dump %threads ~)
  ::
  ::  +threadi: get the thread with the given id
  ::
  ++  threadi
    |=  id=@ud
    ^-  thread
    ::
    =/  root-post=post  (entry %threads id)
    =/  root-replies=(set @)  (replies:poast root-post)
    :-  root-post
    %+  dump  %posts
    %-  some
    :*  %s  %post-id  %|
        |=  post-id=value:n
        ?>  ?=(@ post-id)
        (~(has in root-replies) post-id)
    ==
  ::
  ::  +search: get all posts matching query (including thread metadata)
  ::
  ++  search
    |=  input=@t
    ^-  (list post)
    =/  tokens=(list token:query)  (parse input)
    =/  empty  |*(a=(set) =(0 ~(wyt in a)))
    =/  checks=$-(param:query (set @t))
      |=(p=param:query (silt (turn (skim tokens |=([q=* *] =(p q))) |=([* c=@t] c))))
    %-  dumps
    :_  =/  tag-checks=(set @)  (checks %tag)
        ^-  (unit condition:n)
        ?:  (empty tag-checks)
          ~
        :*  ~  %s  %tags  %|
            |=  =value:n
            ?>  ?=([%s *] value)
            =/  tags=(set @)  ;;((set @) p.value)
            ?|  (empty tag-checks)
                (empty (~(dif in tag-checks) tags))
            ==
        ==
    =/  content-checks=(list tape)
      (turn ~(tap in (checks %content)) |=(t=@t (cass (trip t))))
    =/  author-checks=(set @p)
      (~(run in (checks %author)) |=(t=@t `@p`+:(scan (trip t) ;~(pfix sig crub:so))))
    ^-  (unit condition:n)
    ?:  &(=(~ content-checks) (empty author-checks))
      ~
    :*  ~  %s  %history  %|
        |=  =value:n
        ?>  ?=([%b *] value)
        =/  vpos=post  =+(p=*post p(history ;;(edits p.value)))
        ?&  ?|  =(~ content-checks)
                %+  levy  content-checks
                |=(c=tape ?=(^ (find c (cass (trip (content:poast vpos))))))
            ==
            ?|  (empty author-checks)
                (empty (~(dif in author-checks) (authors:poast vpos)))
    ==  ==  ==
  ::
  ::  +root: get the parent thread (without metadata) of a post
  ::
  ++  root
    |=  id=@ud
    ^-  post
    -:(ancestors id)
  ::
  ::  +ancestors: get a list of ancestors (ordered from root to leaf)
  ::  for a post with given id
  ::
  ++  ancestors
    |=  id=@ud
    ^-  (list post)
    =/  curr=(lest post)  ~[(entry %posts id)]
    |-
    ?:  =(parent-id.i.curr 0)
      curr
    $(curr [(entry %posts parent-id.i.curr) curr])
  ::
  ::  +descendants: get a list of descendants (both thread replies and
  ::  comments) for a post with given id
  ::
  ++  descendants
    =/  id2po  |=(s=(set @) `(list post)`(turn ~(tap in s) |=(i=@ (entry %posts i))))
    |=  id=@ud
    ^-  (list post)
    =/  curr=(list post)  ~
    =/  next=(list post)
      =/  root-post=post  (entry %posts id)
      ?:  !=(parent-id.root-post 0)
        ~[root-post]
      [root-post (id2po (replies:poast (entry %threads id)))]
    |-
    ?~  next
      curr
    %=  $
      curr  [i.next curr]
      next  (weld (id2po comments.i.next) t.next)
    ==
  ::
  ++  entry
    |=  [=name:table id=@]
    ^-  post
    =/  entries=(list post)
      (dump name `[%s ?:(=(name %posts) %post-id %l-post-id) %& %eq id])
    ?~  entries
      ~|("%quorum: unable to find {<name>}-{<id>}" !!)
    i.entries
  ::
  ::  +dumps: all db entries, both posts and threads (optionally filtered)
  ::
  ++  dumps
    |=  [post-filter=(unit condition:n) thread-filter=(unit condition:n)]
    ^-  (list post)
    ?>  ?|(?=([~ *] post-filter) ?=([~ *] thread-filter))
    =/  threads=(list post)
      %+  dump  %threads
      %^    clap
          (bind post-filter (curr cedit:nq |=(t=term (cat 3 'l-' t))))
        (bind thread-filter (curr cedit:nq |=(t=term (cat 3 'r-' t))))
      |=([c1=condition:n c2=condition:n] [%and c1 c2])
    =/  thread-ids=(set @)  (silt (turn threads |=(p=post post-id.p)))
    =/  posts=(list post)
      ?^  thread-filter  ~
      ?~  post-filter    ~
      %+  dump  %posts
      :*  ~  %and  u.post-filter
          %s  %post-id  %|
          |=  post-id=value:n
          ?>  ?=(@ post-id)
          !(~(has in thread-ids) post-id)
      ==
    (weld threads posts)
  ::
  ::  +dump: db entries by table (optionally filtered)
  ::
  ++  dump
    |=  [=name:table filter=(unit condition:n)]
    ^-  (list post)
    %+  turn
      =<  -
      %+  ~(q db:n database)  %quorum
      ?-    name
          %posts
        [%select %posts (fall filter [%n ~])]
      ::
          %threads
        :*  %theta-join  %posts  %threads  %and
            (fall filter [%n ~])
            [%d %l-post-id %r-post-id %& %eq]
        ==
      ==
    |=  =row:n
    !<  post
    :-  -:!>(*post)
    ::  FIXME: Find a better way to convert from a list like
    ::  'row:nectar' to a fixed-length tuple like 'post:quorum'
    :*  post-id=(snag 0 row)
        parent-id=(snag 1 row)
        comments==+(v=(snag 2 row) ?>(?=([%s *] v) p.v))
        votes==+(v=(snag 3 row) ?>(?=([%m *] v) p.v))
        history==+(v=(snag 4 row) ?>(?=([%b *] v) p.v))
        ^=  thread
        ?-    name
            %posts
          ~
        ::
            %threads
          %-  some
          :*  replies==+(v=(snag 6 row) ?>(?=([%s *] v) p.v))
              best-id=(snag 7 row)
              title=(snag 8 row)
              tags==+(v=(snag 9 row) ?>(?=([%s *] v) p.v))
          ==
        ==
        board=board.metadata
        group=group.perm.metadata
    ==
  --
--

/-  *nectar
/+  *mip
|%
::
::  database engine
::
++  db
  |_  =database
  ::
  ::  run a query. if it's a non-mutating query you will get a list of rows.
  ::  this is the only external arm you should use?
  ::
  ++  q
    |=  [=app =query]
    ^-  (quip row ^database)
    ?+  -.query
      =+  (run-query app query ~)
      [(~(get-rows tab -.-) +.-) database]
    ::
      %update        (update app query)
      %insert        `(insert-rows app^table.query rows.query)
      %delete        `(delete app^table.query where.query)
      %add-table     `(add-table app^name.query actual.query)
      %rename-table  `(rename-table app^old.query app^new.query)
      %drop-table    `(drop-table app^name.query)
      %update-rows   `(update-rows app^table.query rows.query)
      ?(%add-column %drop-column %edit-column)
        `(modify-column app^table.query query)
    ==
  ::
  ++  add-table
    |=  [name=table-name =table]
    ^+  database
    ?:  (~(has by database) name)
      ~|("nectar: table with that id already exists" !!)
    =/  existing-rows
      (~(gut by records.table) primary-key.table *record)
    %+  ~(put by database)  name
    %-  ~(create tab table)
    ?:  ?=(%| -.existing-rows)  ~
    ~(val by p.existing-rows)
  ::
  ++  insert-rows
    |=  [name=table-name rows=(list *)]
    ^+  database
    =/  =table  (~(got by database) name)
    %+  ~(put by database)  name
    =-  (~(insert tab table) - update=%.n)
    `(list row)`(turn rows |=(i=* !<(row [-:!>(*row) i])))
  ::
  ++  update-rows
    |=  [name=table-name rows=(list *)]
    ^+  database
    =/  =table  (~(got by database) name)
    %+  ~(put by database)  name
    =-  (~(insert tab table) - update=%.y)
    `(list row)`(turn rows |=(i=* !<(row [-:!>(*row) i])))
  ::
  ++  delete
    |=  [name=table-name where=condition]
    ^+  database
    =/  =table  (~(got by database) name)
    ::  TODO intelligent selection here
    =/  query-key  primary-key.table
    %+  ~(put by database)  name
    (~(delete tab table) query-key where)
  ::
  ++  rename-table
    |=  [old=table-name new=table-name]
    ^+  database
    %+  ~(put by (~(del by database) old))
      new
    (~(got by database) old)
  ::
  ++  drop-table
    |=  name=table-name
    ^+  database
    (~(del by database) name)
  ::
  ++  update
    |=  [app=@tas =query]
    ^-  (quip row ^database)
    ?>  ?=(%update -.query)
    =/  =table  (~(got by database) app^table.query)
    =^  rows  table
      (~(update tab table) primary-key.table where.query cols.query)
    [rows (~(put by database) app^table.query table)]
  ::
  ++  modify-column
    |=  [name=table-name =query]
    ^+  database
    =/  =table  (~(got by database) name)
    %+  ~(put by database)  name
      ?+  -.query  !!
          %add-column
        (~(add-column tab table) +.+.query)
    ::
          %drop-column
        (~(drop-column tab table) col-name.query)
    ::
          %edit-column
        (~(edit-column tab table) +.+.query)
      ==
  ::
  ::  run a NON-MUTATING query and get a list of rows as a result
  ::
  ++  run-query
    |=  [app=@tas =query query-cols=(list column-name)]
    ^-  [table (list column-name)]
    ?>  ?=(?(%select %project %theta-join) -.query)
    =/  [left-tab=table query-cols=(list column-name)]
      ?@  table.query
        [(~(got by database) app^table.query) query-cols]
      $(query table.query)
    ::  here we make smart choices
    ::  we can inspect the query to see what index might be the most useful
    ::  the simplest example is a select statement where want all rows with
    ::  column X equal to a number Y. this is an O(n) process naively, but
    ::  if we store an index for column X, becomes O(log(n)).
    =/  index=(list column-name)
      ?-    -.query
          %project
        ::  a projection must always iterate through all rows, so no
        ::  optimization is possible?
        ~
      ::
          %select
        (choose-key left-tab where.query)
          %theta-join
        (choose-key left-tab where.query)
      ==
    ?-    -.query
        %select
      =?    index
          ?=(~ index)
        primary-key.left-tab
      [(~(select tab left-tab) index where.query) index]
    ::
        %project
      =?    index
          ?=(~ index)
        primary-key.left-tab
      [(~(project tab left-tab) index cols.query) index]
    ::
        %theta-join
      =?    index
          ?=(~ index)
        primary-key.left-tab
      =/  right-tab=table
        ?@  with.query
          (~(got by database) app^with.query)
        -:$(query with.query)
      =/  with=(pair schema (list row))
        :-  schema.right-tab
        (~(get-rows tab right-tab) primary-key.right-tab)
      =/  new-key=key-type
        :*  %+  weld
              %+  turn  primary-key.left-tab
              |=(name=term (cat 3 'l-' name))
            %+  turn  primary-key.right-tab
            |=(name=term (cat 3 'r-' name))
            %.y  ~  %.n  %.n  ::  important
        ==
      =.  left-tab  (~(cross tab left-tab) index new-key with)
      :-  (~(select tab left-tab) cols.new-key where.query)
      cols.new-key
    ==
  ::
  ++  choose-key
    |=  [=table =condition]
    ?-    -.condition
        %n  ~
    ::
        %s
      ?:  (~(has by indices.table) ~[c.condition])
        ~[c.condition]
      ~
    ::
        %d
      ?:  (~(has by indices.table) ~[c1.condition])
        ~[c1.condition]
      ?:  (~(has by indices.table) ~[c2.condition])
        ~[c2.condition]
      ~
    ::
        ?(%and %or)
      =/  try-a=(list column-name)
        $(condition a.condition)
      ?^  try-a  try-a
      $(condition b.condition)
    ==
  --
::
::  table edit engine
::
++  tab
  |_  =table
  ++  col
    |%
    ++  ord
      |=  at-key=(list column-name)
      ^-  $-([key key] ?)
      ::  clustered indices must be keyed on single col
      =/  =column-name  (head at-key)
      =/  col=column-type
        (~(got by schema.table) column-name)
      |=  [a=key b=key]
      ?>  &(?=([p=@ ~] a) ?=([p=@ ~] b))
      ?+  typ.col  (lte i.a i.b)
        %rd  (lte:rd i.a i.b)
        %rh  (lte:rh i.a i.b)
        %rq  (lte:rq i.a i.b)
        %rs  (lte:rs i.a i.b)
        %s   !=(--1 (cmp:si i.a i.b))
        ?(%t %ta %tas)  (aor i.a i.b)
      ==
    --
  ::
  ++  create
    |=  rows=(list row)
    ::  ~&  >  "%nectar: making table"
    ::  ~>  %bout
    ::
    ::  build a new table
    ::  destroys any existing records
    ::
    ::  can only have 1 primary key, must be the indicated one
    ::
    ?>  .=  1
      %-  lent
      %+  skim  ~(tap by indices.table)
      |=  [(list term) key-type]
      primary
    ~|  "%nectar: primary key must also be a unique index"
    ?>  &(primary unique):(~(got by indices.table) primary-key.table)
    ::
    ::  columns must be contiguous from 0
    ::  and have no overlap
    ::
    =/  col-list  ~(tap by schema.table)
    ?>  .=  (gulf 0 (dec (lent col-list)))
        %+  sort
          %+  turn  col-list
          |=  [term column-type]
          spot
        lth
    ::
    ::  clustered and/or autoincremented indices must have singular key column
    ::
    ?>  %-  ~(all by indices.table)
        |=  key-type
        ?.  |(clustered ?=(^ autoincrement))
          %.y
        =(1 (lent cols))
    ::
    ::  make a record for each key
    ::
    =.  records.table
      %-  ~(gas by *(map (list column-name) record))
      %+  turn  ~(tap by indices.table)
      |=  [name=(list column-name) key-type]
      =/  lis=(list [=key =row])
        %+  turn  rows
        |=  =row
        :_  row  ^-  key
        %+  turn  cols
        |=  col=term
        (snag spot:(~(got by schema.table) col) row)
      name^(list-to-record name lis)
    ::  return new table
    table
  ::
  ::  produces a list of rows from a record
  ::
  ++  get-rows
    |=  at-key=(list term)
    ^-  (list row)
    =?    at-key
        ?=(~ at-key)
      primary-key.table
    =/  rec=record  (~(got by records.table) at-key)
    ?:  ?=(%& -.rec)
      ~(val by p.rec)
    %-  zing
    %+  turn  ~(val by p.rec)
    |=  m=(tree [key row])
    ~(val by m)
  ::
  ++  record-to-list
    |=  rec=record
    ^-  (list [key row])
    ?:  ?=(%& -.rec)
      ~(tap by p.rec)
    %-  zing
    %+  turn  ~(tap by p.rec)
    |=  [k=key m=(tree [key row])]
    (turn ~(val by m) |=(v=row [k v]))
  ::
  ++  list-to-record
    |=  [at-key=(list term) lis=(list [=key =row])]
    ^-  record
    =/  =key-type
      ?~  at-key
        (~(got by indices.table) primary-key.table)
      (~(got by indices.table) at-key)
    ?:  unique.key-type
      :-  %&
      ?.  clustered.key-type
        ::  map
        (~(gas by *(map key row)) lis)
      ::  mop
      =/  cmp  (ord:col at-key)
      %+  gas:((on key row) cmp)
      *((mop key row) cmp)  lis
    :-  %|
    =/  spots=(list @)
      %+  turn  primary-key.table
      |=  col=term
      spot:(~(got by schema.table) col)
    ?.  clustered.key-type
      ::  mip
      =/  mi   *(mip key key row)
      |-
      ?~  lis  mi
      =/  pri=key
        %+  turn  spots
        |=(i=@ (snag i row.i.lis))
      $(lis t.lis, mi (~(put bi mi) key.i.lis pri row.i.lis))
    ::  mop-map
    =/  cmp  (ord:col at-key)
    =/  mm  ((on key (map key row)) cmp)
    =/  mop-map  *((mop key (map key row)) cmp)
    |-
    ?~  lis  mop-map
    =/  pri=key
      %+  turn  spots
      |=(i=@ (snag i row.i.lis))
    %=    $
        lis  t.lis
        mop-map
      %^  put:mm  mop-map  key.i.lis
      =+  (get:mm mop-map key.i.lis)
      (~(put by (fall - ~)) pri row.i.lis)
    ==
  ::
  ::
  ::  select using a condition
  ::  accepts a key as hint towards which index to use
  ::  produces this core with only the hinted index modified
  ::
  ++  select
    |=  [at-key=(list term) where=condition]
    ^+  table
    ::  ~&  >  "%nectar: performing select"
    ::  ~>  %bout
    =?    at-key
        ?=(~ at-key)
      primary-key.table
    =/  rec=record  (~(got by records.table) at-key)
    =/  =key-type   (~(got by indices.table) at-key)
    ::  if we have a keyed record for our selector,
    ::  we can use map operations directly
    =-  table(records (~(put by records.table) at-key -))
    |-
    ^-  record
    ?-    -.where
        %s
      ::  single: apply selector on that col
      =/  c  (~(got by schema.table) c.where)
      =/  lis
        |.
        =/  listed  (record-to-list rec)
        =/  skimmed=(list [=key =row])
          %+  skim  listed
          |=  [=key =row]
          (apply-selector s.where (snag spot.c row))
        (list-to-record at-key skimmed)
      ::  if that col is key:
      ::    - %eq we can just get from map
      ::    - %not we can del from map
      ::    if record is clustered:
      ::      - %gte, %lte, %gth, %lth
      ::        can be lotted from mop
      ?.  =(~[c.where] at-key)  (lis)
      ?.  clustered.key-type
        ?.  ?=(%& -.s.where)  (lis)
        ?+    -.p.s.where
            (lis)
        ::
            %eq
          ?:  ?=(%& -.rec)
            ::  map
            ?~  res=(~(get by p.rec) ~[+.p.s.where])
              %&^~
            %&^[[~[+.p.s.where] u.res] ~ ~]
          ::  mip -- retain structure
          %|^[[~[+.p.s.where] (~(gut by p.rec) ~[+.p.s.where] ~)] ~ ~]
        ::
            %not
          ?:  ?=(%& -.rec)
            ::  map
            %&^(~(del by `(map key row)`p.rec) ~[+.p.s.where])
          ::  mip -- but unique key, can del whole inner
          %|^(~(del by `(map key (map key row))`p.rec) ~[+.p.s.where])
        ==
      =/  cmp  (ord:col at-key)
      ?.  ?=(%& -.s.where)  (lis)
      ?+    -.p.s.where
          (lis)
      ::
          %eq
        ?:  ?=(%& -.rec)
          ::  mop
          =/  m  ((on key row) cmp)
          ?~  res=(get:m p.rec ~[+.p.s.where])
            %&^~
          %&^[[~[+.p.s.where] u.res] ~ ~]
        ::  mop-map
        =/  mm  ((on key (map key row)) cmp)
        =+  (get:mm p.rec ~[+.p.s.where])
        %|^[[~[+.p.s.where] (fall - ~)] ~ ~]
      ::
          %not
        ?:  ?=(%& -.rec)
          ::  mop
          =/  m  ((on key row) cmp)
          %&^+:(del:m p.rec ~[+.p.s.where])
        ::  mop-map
        =/  mm  ((on key (map key row)) cmp)
        %|^+:(del:mm p.rec ~[+.p.s.where])
      ::
          ?(%gte %lte %gth %lth)
        ::  mop lot
        ::  mop ordered small -> large
        =/  lot-params
          ?-    -.p.s.where
              %gte
            ?:  =(0 +.p.s.where)  [~ ~]
            [`~[(dec +.p.s.where)] ~]
          ::
            %gth  [`~[+.p.s.where] ~]
            %lte  [~ `~[+(+.p.s.where)]]
            %lth  [~ `~[+.p.s.where]]
          ==
        ?:  ?=(%& -.rec)
          ::  mop
          =/  m   ((on key row) cmp)
          %&^(lot:m p.rec lot-params)
        ::  mop-map
        =/  mm  ((on key (map key row)) cmp)
        %|^(lot:mm p.rec lot-params)
      ::
          %top
        ::  get top n items in clustered index
        ::  TODO performance comparison with different strategies
        ?:  ?=(%& -.rec)
          ::  mop
          =/  m   ((on key row) cmp)
          =+  i=0
          =|  res=(list [key row])
          |-
          ?:  |((gth i n.p.s.where) =(~ p.rec))
            %&^(gas:m *((mop key row) cmp) res)
          =+  popped=(pop:m p.rec)
          $(i +(i), res [-.popped res], p.rec +.popped)
        ::  mop-map
        ~|("nectar: unsupported query TODO" !!)
      ::
          %bottom
        ::  get bottom n items in clustered index
        ::  TODO BROKEN!!! FOR n > 1
        ?:  ?=(%& -.rec)
          ::  mop
          =/  m   ((on key row) cmp)
          ?:  !=(1 n.p.s.where)
            ~|("nectar: unsupported query TODO" !!)
          =+  i=0
          =|  res=(list [key row])
          |-
          ?:  |((gth i n.p.s.where) =(~ p.rec))
            %&^(gas:m *((mop key row) cmp) res)
          =+  rammed=(ram:m p.rec)
          $(i +(i), res [+.rammed res], p.rec -.rammed)
        ::  mop-map
        ~|("nectar: unsupported query TODO" !!)
      ==
    ::
        %d
      ::  dual: apply comparator across two cols
      ::  if both cols are keys, can fix one and
      ::  then transform comparator into selector
      ::  such that we get to use map operations
      ::  all the way. (TODO implement)
      ::
      ::  if one or both cols is *not* a key, need
      ::  to traverse all rows.
      =/  c1  (~(got by schema.table) c1.where)
      =/  c2  (~(got by schema.table) c2.where)
      =/  listed  (record-to-list rec)
      =/  skimmed=(list [=key =row])
        %+  skim  listed
        |=  [=key =row]
        %^  apply-comparator  com.where
        (snag spot.c1 row)  (snag spot.c2 row)
      (list-to-record at-key skimmed)
    ::
        %n
      ::  no where clause means get everything
      rec
    ::
        %or
      ::  both clauses applied to full record
      =/  rec1=record  $(where a.where)
      =/  rec2=record  $(where b.where)
      ::  merge two results
      ::  records will share clustered/unique status
      ?.  clustered.key-type
        ?:  ?=(%& -.rec1)
          ?>  ?=(%& -.rec2)
          ::  map
          %&^(~(uni by p.rec1) p.rec2)
        ?>  ?=(%| -.rec2)
        ::  mip  TODO
        ::  %|^(uni-mip p.rec1 p.rec2)
        ~|("nectar: unsupported query TODO" !!)
      =/  cmp  (ord:col at-key)
      ?:  ?=(%& -.rec1)
        ?>  ?=(%& -.rec2)
        ::  mop
        =/  m  ((on key row) cmp)
        %&^(uni:m p.rec1 p.rec2)
      ?>  ?=(%| -.rec2)
      ::  mop-map  TODO
      ::  %|^(uni-mop-map p.rec1 p.rec2 cmp)
      ~|("nectar: unsupported query TODO" !!)
    ::
        %and
      ::  clauses applied sequentially to one record
      =.  rec  $(where a.where)
      $(where b.where)
    ==
  ::
  ::  produces a new table with rows inserted across all records
  ::
  ++  insert
    |=  [rows=(list row) update=?]
    ^+  table
    ::  ~&  >  "%nectar: performing insert/update"
    ::  ~>  %bout
    =.  records.table
      %-  ~(rut by records.table)
      |=  [name=(list term) =record]
      =/  =key-type  (~(got by indices.table) name)
      =/  lis=(list [=key =row])
        %+  turn  rows
        |=  =row
        :_  row  ^-  key
        %+  turn  cols.key-type
        |=  col=term
        (snag spot:(~(got by schema.table) col) row)
      ?:  unique.key-type
        ?>  ?=(%& -.record)
        ?.  clustered.key-type
          ::  map
          |-
          ?~  lis  record
          ?:  (~(has by p.record) key.i.lis)
            ?.  update
              ~|("non-unique key on insert" !!)
            $(lis t.lis, p.record (~(put by p.record) i.lis))
          $(lis t.lis, p.record (~(put by p.record) i.lis))
        ::  mop
        ?>  ?=(%& -.record)
        =/  cmp  (ord:col name)
        =/  m    ((on key row) cmp)
        |-
        ?~  lis  record
        ~|  "non-unique key on insert"
        ?:  (has:m p.record key.i.lis)
          ?.  update
            ~|("non-unique key on insert" !!)
          $(lis t.lis, p.record (put:m p.record i.lis))
        $(lis t.lis, p.record (put:m p.record i.lis))
      ?>  ?=(%| -.record)
      ::  for non-unique records, primary key
      ::  uniqueness is enforced by inserting to
      ::  guaranteed-unique map/mop elsewhere
      =/  spots=(list @)
        %+  turn  primary-key.table
        |=  col=term
        spot:(~(got by schema.table) col)
      ?.  clustered.key-type
        ::  mip
        |-
        ?~  lis  record
        =/  pri=key
          %+  turn  spots
          |=(i=@ (snag i row.i.lis))
        $(lis t.lis, p.record (~(put bi p.record) key.i.lis pri row.i.lis))
      ::  mop-map
      =/  cmp  (ord:col name)
      =/  mm   ((on key (map key row)) cmp)
      |-
      ?~  lis  record
      =/  pri=key
        %+  turn  spots
        |=(i=@ (snag i row.i.lis))
      %=    $
          lis  t.lis
          p.record
        %^  put:mm  p.record  key.i.lis
        =+  (get:mm p.record key.i.lis)
        (~(put by (fall - ~)) pri row.i.lis)
      ==
    table
  ::
  ::  produces a new table with rows meeting the condition
  ::  deleted across all records. after deleting records,
  ::  needs to rebuild all secondary indices, so deletes
  ::  take a pretty long time...  TODO optimize?
  ::
  ++  delete
    |=  [at-key=(list term) where=condition]
    ^+  table
    ::  ~&  >  "%nectar: performing delete"
    ::  ~>  %bout
    =?    at-key
        ?=(~ at-key)
      primary-key.table
    =/  =key-type  (~(got by indices.table) at-key)
    =/  rec        (~(got by records.table) at-key)
    ?.  clustered.key-type
      =/  del  (~(got by records:(select at-key where)) at-key)
      ?:  ?=(%& -.rec)
        ?>  ?=(%& -.del)
        ::  map
        (create ~(val by (~(dif by p.rec) p.del)))
      ?>  ?=(%| -.del)
      ::  mip
      ::  %|^(dif-jar p.rec p.del)
      ~|("nectar: unsupported query TODO" !!)
    ::  for mop, rather than defer to select,
    ::  need to perform logical comparison by key and delete
    ::  or if an un-indexed column, must skim list
    ::  TODO implement key optimization
    =/  listed  (record-to-list rec)
    =/  skipped=(list row)
      %+  murn  listed
      |=  [=key =row]
      ?:  (apply-condition schema.table where row)
        ~
      `row
    (create skipped)
  ::
  ::  update all rows that meet condition at column with function
  ::
  ++  update
    |=  [at-key=(list term) where=condition cols=(list [term $-(value value)])]
    ^-  (quip row ^table)
    =?    at-key
        ?=(~ at-key)
      primary-key.table
    =/  col-spots=(map @ $-(value value))
      %-  ~(gas by *(map @ $-(value value)))
      %+  turn  cols
      |=  [=term func=$-(value value)]
      :-  spot:(~(got by schema.table) term)
      func
    =/  new-rows
      %+  turn
        `(list row)`(~(get-rows tab (select at-key where)) at-key)
      |=  =row
      =<  p
      %^  spin  row  0
      |=  [=value i=@]
      :_  +(i)
      ?~  c=(~(get by col-spots) i)  value
      (u.c value)
    [new-rows (insert new-rows update=&)]
  ::
  ::  produces a list of rows along with a schema for interpreting
  ::  those rows, since projection creates a new row-ordering
  ::
  ++  project
    |=  [at-key=(list term) cols=(list term)]
    ^+  table
    ::  ~&  >  "%nectar: performing projection"
    ::  ~>  %bout
    ::  need to iterate through all rows, so no need
    ::  to determine optimal record to pull from?
    =/  new-schema
      %-  ~(gas by *(map term column-type))
      =<  p
      %^  spin  cols  0
      |=  [=term i=@]
      =/  col  (~(got by schema.table) term)
      [[term col(spot i)] +(i)]
    ~|  "primary key columns must be retained in projection"
    ?>  %+  levy  primary-key.table
        |=  col=term
        (~(has by new-schema) col)
    =/  is=(list @)
      %+  turn  cols
      |=  =term
      spot:(~(got by schema.table) term)
    =/  lis=(list [key row])
      %+  turn
        (record-to-list (~(got by records.table) at-key))
      |=  [=key =row]
      :-  key
      %+  turn  is
      |=(i=@ (snag i row))
    =.  schema.table  new-schema
    =.  records.table
      [at-key^(list-to-record at-key lis) ~ ~]
    table
  ::
  ::  cross-product: combinatorily join two records
  ::  places the result as a record -- you choose the key
  ::
  ++  cross
    |=  [at-key=(list term) new-key=key-type with=(pair schema (list row))]
    ^+  table
    ::  ~&  >  "%nectar: performing cross-product"
    ::  ~>  %bout
    =/  l  ~(wyt by schema.table)
    =.  schema.table
      %-  ~(gas by *(map term column-type))
      %+  weld
        %+  turn  ~(tap by schema.table)
        |=  [=term c=column-type]
        [(cat 3 'l-' term) c]
      %+  turn  ~(tap by p.with)
      |=  [=term c=column-type]
      [(cat 3 'r-' term) c(spot (add spot.c l))]
    =/  lis=(list [key row])
      %-  zing
      %+  turn  (get-rows at-key)
      |=  l=row
      %+  turn  q.with
      |=  r=row
      =/  grow=row  (weld l r)
      :_  grow  ^-  key
      %+  turn  cols.new-key
      |=  col=column-name
      (snag spot:(~(got by schema.table) col) grow)
    =.  indices.table
      [cols.new-key^new-key ~ ~]
    =.  primary-key.table  cols.new-key
    =.  records.table
      [cols.new-key^(list-to-record cols.new-key lis) ~ ~]
    table
  ::
  ::  union: concatenate two records
  ::
  ++  union
    |=  [at-key=(list term) with=(pair schema (list row))]
    ::  ~&  >  "%nectar: performing union"
    ::  ~>  %bout
    ^-  (pair schema (list row))
    =/  l  ~(wyt by schema.table)
    ::  unlike cross-product, if two columns in schemae
    ::  share the same name, they become the same column
    ::  TODO adjust to get correct spot values
    :-  %-  (~(uno by schema.table) p.with)
        |=  [term c1=column-type c2=column-type]
        ::  if overlap, take type from our table
        [0 |(optional.c1 optional.c2) typ.c1]
    ::  TODO pad rows to get proper alignment
    %+  weld
      (get-rows at-key)
    q.with
  ::
  ::  add-column: adds new column into table records
  ::
  ++  add-column
    |=  [col-name=term col=column-type fill=value]
    =.  schema.table
      ::  always add the new column
      =;  new=schema
        (~(put by new) col-name col)
      ::  if spot taken, shift existing spots that come after to the right
      =+  %+  turn
            ~(val by schema.table)
          |=(a=column-type spot.a)
      ?~  %+(find ~[spot.col] -)
        schema.table
      %-  ~(urn by schema.table)
      |=  [term b=column-type]
      ?.  (gte spot.b spot.col)
        b
      b(spot +(spot.b))
    ::  add new empty column to records
    =/  new-rows=(list row)
      %+  turn
        `(list row)`(~(get-rows tab table) ~)
      |=  =row
      `^row`(into row spot.col fill)
    (insert new-rows update=&)
  ::
  ::  drop-column: remove column from table
  ::
  ++  drop-column
    |=  col-name=term
    ^+  table
    ~|  '%nectar: cannot drop column inside primary key'
    ?>  .=(~ (find ~[col-name] primary-key.table))
    =/  to-drop=column-type  (~(got by schema.table) col-name)
    ::  Remove indices which include dropped column
    =.  indices.table
      %-  malt
      %+  skim
      ~(tap by indices.table)
      |=  [a=(list column-name) key-type]
      ?^((find ~[col-name] a) %| %&)
    ::  Shift spots after dropped column to the left,
    ::  Remove column entry from schema
    =.  schema.table
      %.  col-name
      %~  del  by
      %-  ~(urn by schema.table)
      |=  [term b=column-type]
      ?.  (gte spot.b spot.to-drop)
        b
      b(spot (sub spot.b 1))
    ::  Delete entries from records when dropped column is in key
    =.  records.table
      %-  malt
      %+  skim
        ~(tap by records.table)
      |=  [a=(list term) record]
      ?^((find ~[col-name] a) %| %&)
    =/  new-rows=(list row)
      %+  turn
      `(list row)`(~(get-rows tab table) ~)
      |=(=row (oust [spot.to-drop 1] row))
    (insert new-rows update=&)
  ::
  ++  edit-column
    |=  [col-name=term new-opt=(unit ?) new-typ=(unit typ)]
    =+  (~(got by schema.table) col-name)
    =.  optional
      ?@(new-opt optional (need new-opt))
    =.  typ
      ?@(new-typ typ (need new-typ))
    table(schema (~(put by schema.table) col-name -))
  --
::
++  apply-condition
  |=  [=schema cond=condition =row]
  ^-  ?
  ?-    -.cond
    %n  %.y
  ::
      %s
    =-  (apply-selector s.cond -)
    (snag spot:(~(got by schema) c.cond) row)
  ::
      %d
    =-  (apply-comparator com.cond -)
    :-  (snag spot:(~(got by schema) c1.cond) row)
    (snag spot:(~(got by schema) c2.cond) row)
  ::
      %and
    ?:  $(cond a.cond)
      $(cond b.cond)
    %.n
  ::
      %or
    |($(cond a.cond) $(cond b.cond))
  ==
::
++  apply-selector
  |=  [=selector a=value]
  ^-  ?
  ?.  ?=(%& -.selector)
    (p.selector a)
  ?>  ?=(@ a)
  ?-  -.p.selector
    %eq    =(a +.p.selector)
    %not   !=(a +.p.selector)
    %gte   (gte a +.p.selector)
    %lte   (lte a +.p.selector)
    %gth   (gth a +.p.selector)
    %lth   (lth a +.p.selector)
    %nul   =(~ a)
    ?(%top %bottom)  ~|("%nectar: applied invalid selector" !!)
    %text-find  ?=(^ (find t.p.selector (trip a)))
  ==
::
++  apply-comparator
  |=  [=comparator a=value b=value]
  ^-  ?
  ?.  ?=(%& -.comparator)
    (p.comparator a b)
  ?>  &(?=(@ a) ?=(@ b))
  ?-  p.comparator
    %eq    =(a b)
    %not   !=(a b)
    %gte   (gte a b)
    %lte   (lte a b)
    %gth   (gth a b)
    %lth   (lth a b)
  ==
::
::  missing jar utils
::
++  tap-jar
  |=  j=(tree [key (list row)])
  ^-  (list [key row])
  %-  zing
  %+  turn  ~(tap by j)
  |=  [k=key l=(list row)]
  (turn l |=(r=row [k r]))
::
++  uni-jar
  |=  [a=(tree [=key rows=(list row)]) b=(tree [=key rows=(list row)])]
  ^+  a
  ?~  b  a
  ?~  a  b
  ?:  =(key.n.a key.n.b)
    ::  if keys match, instead of overriding item in a,
    ::  weld together two lists and remove duplicates
    ::  this is likely very slow. so, simply don't make
    ::  %or queries that overlap!
    :_  [l=$(a l.a, b l.b) r=$(a r.a, b r.b)]
    n=[key.n.a ~(tap in (silt (weld rows.n.a rows.n.b)))]
  ?:  (mor key.n.a key.n.b)
    ?:  (gor key.n.b key.n.a)
      $(l.a $(a l.a, r.b ~), b r.b)
    $(r.a $(a r.a, l.b ~), b l.b)
  ?:  (gor key.n.a key.n.b)
    $(l.b $(b l.b, r.a ~), a r.a)
  $(r.b $(b r.b, l.a ~), a l.a)
::
::  mop-jar utils
::
++  uni-mop-jar
  |=  $:  a=(tree [=key rows=(list row)])
          b=(tree [=key rows=(list row)])
          cmp=$-([key key] ?)
      ==
  ^+  a
  ?~  b  a
  ?~  a  b
  ?:  =(key.n.a key.n.b)
    :_  [l=$(a l.a, b l.b) r=$(a r.a, b r.b)]
    n=[key.n.a ~(tap in (silt (weld rows.n.a rows.n.b)))]
  ?:  (mor key.n.a key.n.b)
    ?:  (cmp key.n.b key.n.a)
      $(l.a $(a l.a, r.b ~), b r.b)
    $(r.a $(a r.a, l.b ~), b l.b)
  ?:  (cmp key.n.a key.n.b)
    $(l.b $(b l.b, r.a ~), a r.a)
  $(r.b $(b r.b, l.a ~), a l.a)
--
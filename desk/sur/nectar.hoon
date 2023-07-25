::  nectar:
::     relational
::            database
::
|%
::  +database: map of tables
+$  database  (map table-name table)
::  need name of app poking to be in bowl! for now, this:
+$  query-poke      [=app =query]
+$  procedure-poke  [=app =label =stored-procedure]
::  poke with this to indicate that you want to track a remote table
+$  track
  %+  pair  app  ::  the local app poking us, for now
  $%  [%start source=@p =table-name]
      [%stop source=@p =table-name]
  ==
::
+$  set-perms
  %+  pair  table-name  ::  the local app poking us, for now
  $%  [%private ~]
      [%public ~]
      [%set (set @p)]
      [%add (set @p)]
      [%del (set @p)]
  ==
::
+$  app    term
+$  label  @
+$  table-name  [=app =label]
::
::  TODO:  external indices
::  make index a separate object from table
::  store them alongside tables
::  be able to store indices for *other* tables
::  (do after solid-state-publications)
::  (use: find another table somewhere)
::
+$  table
  $:  =schema
      primary-key=(list column-name)
      =indices
      records=(map (list column-name) record)
  ==
::
+$  schema   (map term column-type)  ::  term is semantic label
+$  indices  (map (list column-name) key-type)
::
+$  key-type
  $:  ::  which columns included in key (at list position)
      cols=(list column-name)
      ::  only one primary key per table (must be unique!)
      primary=?
      ::  if non-null, swaps *singular* key column with the @ud
      ::  value of +(current one), and increments itself.
      autoincrement=(unit @ud)
      ::  if not unique, store rows in submap under key
      unique=?
      ::  uses col-ord -- if clustered,
      ::  must be *singular* column in key.
      clustered=?
  ==
::
+$  typ
  $?  %ud  %ux  %da  %dr  %f  %p
      %t   %ta  %tas
      %rd  %rh  %rq  %rs  %s
      ::  more complex column types
      %list  %set  %map  %blob
  ==
::
+$  column-name  term
+$  column-type
  $:  spot=@      ::  where column sits in row
      optional=?  ::  if optional, value is unit
      =typ
  ==
::
+$  record
  %+  each
    (tree [key row])             ::  unique key
  (tree [key (tree [key row])])  ::  non-unique key
::
+$  key  (list value)
+$  row  (list value)
+$  value
  $@  @
  $?  (unit @)
  $%  [%l p=(list value)]       [%s p=(set value)]
      [%m p=(map value value)]  [%b p=*]
      [%j p=(jug value value)]
  ==  ==
::
+$  condition
  $~  [%n ~]
  $%  [%n ~]
      [%s c=term s=selector]
      [%d c1=term c2=term com=comparator]
      [%and a=condition b=condition]
      [%or a=condition b=condition]
  ==
::
+$  selector
  ::  concrete or dynamic
  %+  each
    $%  [%eq @]   [%not @]
        [%gte @]  [%lte @]
        [%gth @]  [%lth @]
        [%nul ~]
        ::  only accepted on clustered indices
        [%top n=@]     ::  get the first n rows in order
        [%bottom n=@]  ::  get the last n rows in order
        ::  only accepted on columns of type @t, @ta, @tas
        [%text-find t=tape]
    ==
  $-(value ?)
::
+$  comparator
  ::  concrete or dynamic
  %+  each
    ?(%eq %not %gte %gth %lte %lth)
  $-([value value] ?)
::
+$  query
  $%  [%select table=?(@ query) where=condition]
      [%project table=?(@ query) cols=(list term)]
      [%theta-join table=?(@ query) with=?(@ query) where=condition]
      [%update table=@ where=condition cols=(list [=term func=mod-func])]
      [%update-rows table=@ rows=(list *)]
      [%insert table=@ rows=(list *)]
      [%delete table=@ where=condition]
      [%add-table name=@ actual=table]
      [%rename-table old=@ new=@]
      [%drop-table name=@]
      ::  NOTE: if you edit your table schema, and you're molding the
      ::  rows in your app, that mold MUST change alongside the schema!
      [%add-column table=@ col-name=@ =column-type fill=value]
      [%drop-column table=@ col-name=@]
      [%edit-column table=@ col-name=@ optional=(unit ?) typ=(unit typ)]
      ::  ??
  ==
::
+$  mod-func  $-(value value)
::
+$  stored-procedure
  (pair (list [aura axis]) query)
::
::  helpers
::
++  make-schema
  |=  lis=(list [term column-type])
  ^-  schema
  (~(gas by *schema) lis)
::
++  make-indices
  |=  lis=(list key-type)
  ^-  indices
  %-  ~(gas by *indices)
  %+  turn  lis
  |=  =key-type
  [cols.key-type key-type]
--

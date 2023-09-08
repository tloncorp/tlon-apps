::  volume: groups notification settings
::
/-  g=groups
::
^?
|%
+$  value  ?(~ level)  ::  default or set
+$  level
  $~  %soft
  $?  %loud  ::  always notify
      %soft  ::  sometimes notify
      %hush  ::  never notify
  ==
::
+$  scope
  $@  ~
  $%  [%group flag:g]
      [%channel nest:g]
  ==
::  +fit-level: full "do we want a notification for this" check
::
++  fit-level
  |=  [our=@p now=@da]
  =+  get-level=(get-level our now)
  |=  [=scope =level]
  %+  gte-level  level
  (get-level scope)
::  +gte-level: whether to send a notification
::
++  gte-level
  |=  [send=level conf=level]
  ^-  ?
  ?-  conf
    %hush  |
    %soft  !=(%loud send)
    %loud  &
  ==
::
++  get-level
  |=  [our=@p now=@da]
  |=  =scope
  ^-  level
  =;  =value
    ::  %group or %channel scopes may give us a ~ value,
    ::  deferring back to the user-configured default level,
    ::  which we can scry out directly.
    ::
    ?~(value $(scope ~) value)
  |^  ^-  value
      ?.  .^(? %gu (make-beam %groups /$))
        *level
      =;  =spur
        .^(value %gx (make-beam %groups %volume (snoc spur %volume-value)))
      ?-  scope
        ~             /
        [%group *]    /(scot %p p.scope)/[q.scope]
        [%channel *]  /[p.scope]/(scot %p p.q.scope)/[q.q.scope]
      ==
  ::
  ++  make-beam
    |=  [=desk =spur]
    ^-  path
    [(scot %p our) desk (scot %da now) spur]
  --
--

::  tests for the pure %buckets helpers
::
::  These cover the arms the agent's own behaviour tests can only reach
::  indirectly: tree walking over a manifest, and reading a broker answer.
::
/-  b=buckets
/+  *test, util=buckets-util
|%
++  who  ~sampel-palnet
++  then  ~2026.1.1
::  +folder: a folder entry under .parent
::
++  folder
  |=  [id=@ud parent=(unit @ud)]
  ^-  entry:b
  [id parent (crip "f{<id>}") who then who then [%folder ~]]
::  +doc: a file entry under .parent
::
++  doc
  |=  [id=@ud parent=(unit @ud)]
  ^-  entry:b
  =/  fil=file:b  ['text/plain' 10 ~ (scot %ud id) %ready]
  [id parent (crip "d{<id>}") who then who then [%file fil]]
::  +state-of: a bucket holding .ents
::
++  state-of
  |=  ents=(list entry:b)
  ^-  bucket-state:b
  :*  [1 'files' who then who then]
      [who %the-group]
      (silt ~[%admin])
      (malt (turn ents |=(e=entry:b [id.e e])))
      0
  ==
::  the tree used throughout: 1 is a root folder holding 2 (a folder) and 4
::  (a file); 2 holds 3. 5 is a sibling root that must never be swept in.
::
++  tree
  ^-  bucket-state:b
  %-  state-of
  :~  (folder 1 ~)
      (folder 2 `1)
      (doc 3 `2)
      (doc 4 `1)
      (folder 5 ~)
  ==
::  +res: a finished broker answer carrying .body
::
++  res
  |=  body=@t
  ^-  client-response:iris
  :+  %finished
    [200 ~]
  `['application/json' [(met 3 body) body]]
::
::  manifest helpers
::
++  test-descendants-takes-the-whole-subtree
  %+  expect-eq
    !>  (silt ~[1 2 3 4])
  !>  (descendants:util tree 1)
::
++  test-descendants-of-a-leaf-is-itself
  %+  expect-eq
    !>  (silt ~[3])
  !>  (descendants:util tree 3)
::
++  test-descendants-ignores-a-sibling-root
  %+  expect-eq
    !>  |
  !>  (~(has in (descendants:util tree 1)) 5)
::
++  test-descendant-walks-up-through-a-folder
  %+  expect-eq
    !>  &
  !>  (descendant:util tree 1 3)
::
++  test-descendant-is-reflexive
  %+  expect-eq
    !>  &
  !>  (descendant:util tree 2 2)
::
++  test-descendant-is-not-symmetric
  %+  expect-eq
    !>  |
  !>  (descendant:util tree 3 1)
::
::  This is the check that stops a folder being moved inside itself, which
::  would strand the whole subtree: unreachable from the root and undeletable,
::  because a delete walks down from a parent that is now its own child.
::
++  test-descendant-refuses-an-unrelated-branch
  %+  expect-eq
    !>  |
  !>  (descendant:util tree 5 3)
::
++  test-valid-parent-accepts-the-root
  %+  expect-eq
    !>  &
  !>  (valid-parent:util tree ~)
::
++  test-valid-parent-rejects-a-file
  %+  expect-eq
    !>  |
  !>  (valid-parent:util tree `4)
::
++  test-valid-parent-rejects-a-missing-entry
  %+  expect-eq
    !>  |
  !>  (valid-parent:util tree `99)
::
++  test-valid-mime-wants-a-type-and-a-subtype
  ;:  weld
    (expect-eq !>(&) !>((valid-mime:util 'image/png')))
    (expect-eq !>(|) !>((valid-mime:util '')))
    (expect-eq !>(|) !>((valid-mime:util 'image')))
    (expect-eq !>(|) !>((valid-mime:util '/png')))
    (expect-eq !>(|) !>((valid-mime:util 'image/')))
  ==
::
::  replica transitions
::
++  test-apply-update-deletes-a-set-of-entries
  %+  expect-eq
    !>  (silt ~[1 5])
  !>  ~(key by entries:(apply-update:util tree [%entries-deleted ~[2 3 4]]))
::
++  test-apply-update-puts-an-entry
  =/  next=bucket-state:b
    (apply-update:util tree [%entry 6 [%create (doc 6 `1)]])
  %+  expect-eq
    !>  `entry:b`(doc 6 `1)
  !>  (~(got by entries.next) 6)
::
++  test-apply-update-leaves-a-delete-alone
  %+  expect-eq
    !>  tree
  !>  (apply-update:util tree [%delete ~])
::
::  reader records
::
++  test-reader-status-expiry-beats-everything
  ::  owed, refused and settled all read %lapsed once the expiry has passed:
  ::  the token the record names can no longer be used by anyone.
  =/  sync=reader-sync:b  [2 'b1' [%granted 'tok' then] then 1 & ~]
  %+  expect-eq
    !>  %lapsed
  !>  (reader-status:util sync then)
::
++  test-reader-status-refusal-settles-a-live-record
  =/  sync=reader-sync:b  [2 'b1' [%granted 'tok' then] then 1 & ~]
  %+  expect-eq
    !>  %refused
  !>  (reader-status:util sync (sub then ~h1))
::
++  test-reader-status-level-with-the-broker-is-settled
  =/  sync=reader-sync:b  [2 'b1' [%granted 'tok' then] then 2 | ~]
  %+  expect-eq
    !>  %settled
  !>  (reader-status:util sync (sub then ~h1))
::
++  test-reader-status-behind-the-broker-is-owed
  =/  sync=reader-sync:b  [3 'b1' [%granted 'tok' then] then 2 | ~]
  %+  expect-eq
    !>  %owed
  !>  (reader-status:util sync (sub then ~h1))
::
::  broker answers
::
++  test-broker-applied-reads-the-flag
  %+  expect-eq
    !>  `(unit ?)``|
  !>  (broker-applied:util (res '{"applied":false}'))
::
++  test-broker-applied-is-absent-when-unsaid
  %+  expect-eq
    !>  `(unit ?)`~
  !>  (broker-applied:util (res '{"currentRevision":4}'))
::
::  The broker sends this as a JSON number, and a quoted one is not accepted
::  -- so a broker that started quoting it would read as "said nothing" and
::  fall back on the revision comparison rather than being silently misparsed.
::
++  test-broker-revision-reads-a-number-not-a-string
  ;:  weld
    %+  expect-eq  !>(`(unit @ud)``4)
    !>((broker-revision:util (res '{"currentRevision":4}')))
  ::
    %+  expect-eq  !>(`(unit @ud)`~)
    !>((broker-revision:util (res '{"currentRevision":"4"}')))
  ==
::
::  A transport failure carries no body at all, and those are exactly the
::  attempts worth making again -- so absent means retryable.
::
++  test-broker-retryable-defaults-to-true
  ;:  weld
    (expect-eq !>(&) !>((broker-retryable:util (res '{}'))))
    (expect-eq !>(|) !>((broker-retryable:util (res '{"retryable":false}'))))
    (expect-eq !>(&) !>((broker-retryable:util [%cancel ~])))
  ==
::
++  test-broker-message-falls-back-when-unreadable
  ;:  weld
    %+  expect-eq  !>('nope')
    !>((broker-message:util (res '{"message":"nope"}')))
  ::
    %+  expect-eq  !>('storage refused the upload')
    !>((broker-message:util (res 'not json at all')))
  ==
::
++  test-broker-headers-keeps-only-well-formed-pairs
  %+  expect-eq
    !>  ~[['x-a' '1']]
  !>  %-  broker-headers:util
      %-  need
      %-  ^:((unit (map @t json)))
      (broker-body:util (res '{"requiredHeaders":[["x-a","1"],["bad"],3]}'))
::
++  test-broker-body-rejects-a-non-object
  %+  expect-eq
    !>  ~
  !>  (broker-body:util (res '[1,2]'))
::
::  formatting
::
++  test-ship-text-drops-the-sig
  %+  expect-eq
    !>  '~sampel-palnet'
  !>  `@t`(rap 3 '~' (ship-text:util ~sampel-palnet) ~)
::
++  test-from-unix-ms-truncates-to-seconds
  %+  expect-eq
    !>  (from-unix:chrono:userlib 1)
  !>  (from-unix-ms:util 1.999)
::
++  test-url-encode-escapes-a-separator
  %+  expect-eq
    !>  'a%2Fb'
  !>  (url-encode:util 'a/b')
--

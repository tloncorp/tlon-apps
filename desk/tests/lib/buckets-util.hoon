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
  (res-at 200 body)
::  +res-at: a finished broker answer under .code carrying .body as JSON
::
++  res-at
  |=  [code=@ud body=@t]
  ^-  client-response:iris
  :+  %finished
    [code ~]
  `['application/json' [(met 3 body) body]]
::  +html-at: an answer from something in front of the broker -- a proxy's
::  own error page under .code, carrying no JSON at all
::
++  html-at
  |=  [code=@ud body=@t]
  ^-  client-response:iris
  :+  %finished
    [code ~]
  `['text/html' [(met 3 body) body]]
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
  ::
    %+  expect-eq  !>(`(unit @ud)`~)
    !>((broker-revision:util (res '{"currentRevision":-1}')))
  ::
    %+  expect-eq  !>(`(unit @ud)`~)
    !>((broker-revision:util (res '{"currentRevision":1.5}')))
  ==
::
::  The body decides when it speaks, whatever the status. When it does not
::  -- an empty object, a proxy's error page or no body at all -- the status
::  decides: a 429 or a 5xx is worth repeating, any other status is final.
::  A cancelled request has no status and is worth asking about again.
::
++  test-broker-retryable-status
  ;:  weld
    (expect-eq !>(&) !>((broker-retryable:util [%cancel ~])))
    (expect-eq !>(&) !>((broker-retryable:util (res-at 503 '{}'))))
    (expect-eq !>(&) !>((broker-retryable:util (res-at 429 '{}'))))
  ::
    %+  expect-eq  !>(&)
    !>((broker-retryable:util (html-at 502 '<html>bad gateway</html>')))
  ::
    (expect-eq !>(&) !>((broker-retryable:util [%finished [502 ~] ~])))
    (expect-eq !>(|) !>((broker-retryable:util (res-at 400 '{}'))))
  ::
    %+  expect-eq  !>(|)
    !>((broker-retryable:util (res-at 503 '{"retryable":false}')))
  ::
    %+  expect-eq  !>(&)
    !>((broker-retryable:util (res-at 400 '{"retryable":true}')))
  ==
::
::  A refusal is parsed into what the uploader can act on. A cancelled
::  request is an unknown outcome worth asking about again; a body we cannot
::  read, or one with no code, is a refusal we know nothing more about, and
::  the status says whether to repeat it, the same way +broker-retryable
::  does -- a proxy's bodyless 502 is retryable, an empty 400 is final.
::
++  test-broker-error-reads-the-broker-fields
  =/  refusal=[message=@t =broker-error:b]
    %+  broker-error:util
      %-  res
      '{"code":"rate_limited","message":"slow down","retryable":true,"retryAfterMs":5000,"scope":"host"}'
    3.600.000
  =/  expected=[message=@t =broker-error:b]
    ['slow down' ['rate_limited' & `5.000 `'host']]
  ;:  weld
    (expect-eq !>(expected) !>(refusal))
  ::
    %+  expect-eq
      !>  ^-  [message=@t =broker-error:b]
      ['storage refused the upload' ['unknown' & ~ ~]]
    !>((broker-error:util (html-at 502 '<html>bad gateway</html>') 3.600.000))
  ::
    %+  expect-eq
      !>  ^-  [message=@t =broker-error:b]
      ['storage refused the upload' ['unknown' | ~ ~]]
    !>((broker-error:util (res-at 400 '{}') 3.600.000))
  ==
::
++  test-broker-error-clamps-retry-after-and-drops-nonsense
  =/  parse
    |=  [body=@t ceiling=@ud]
    ^-  broker-error:b
    broker-error:(broker-error:util (res body) ceiling)
  =/  after
    |=  [num=@t ceiling=@ud]
    ^-  (unit @ud)
    =/  body=@t
      (rap 3 '{"code":"rate_limited","retryAfterMs":' num '}' ~)
    retry-after:(parse body ceiling)
  ;:  weld
    (expect-eq !>(`(unit @ud)``60.000) !>((after '120000' 60.000)))
    (expect-eq !>(`(unit @ud)`~) !>((after '0' 3.600.000)))
    (expect-eq !>(`(unit @ud)`~) !>((after '"5000"' 3.600.000)))
    (expect-eq !>(`(unit @ud)`~) !>((after '-5000' 3.600.000)))
    (expect-eq !>(`(unit @ud)``3.600.000) !>((after '7200000' 3.600.000)))
    (expect-eq !>(`(unit @ud)`~) !>((after '5000' 0)))
    (expect-eq !>(`(unit @ud)``5.001) !>((after '5000.4' 3.600.000)))
    (expect-eq !>(`(unit @ud)``5.000) !>((after '5000.0' 3.600.000)))
    (expect-eq !>(`(unit @ud)``1.500) !>((after '1.5e3' 3.600.000)))
    (expect-eq !>(`(unit @ud)``1) !>((after '0.3' 3.600.000)))
    (expect-eq !>(`(unit @ud)``1) !>((after '1e00' 3.600.000)))
    (expect-eq !>(`(unit @ud)``1) !>((after '1E+00' 3.600.000)))
    (expect-eq !>(`(unit @ud)``5) !>((after '5.0e-000' 3.600.000)))
    (expect-eq !>(`(unit @ud)``3.600.000) !>((after '1e309' 3.600.000)))
    (expect-eq !>(`(unit @ud)`~) !>((after '-1e309' 3.600.000)))
    ::  An exponent too large to compute is settled by its sign alone.
    (expect-eq !>(`(unit @ud)``3.600.000) !>((after '1e9999999999' 3.600.000)))
    ::  Past a year the exponent alone settles it; under it the value is computed.
    (expect-eq !>(`(unit @ud)``3.600.000) !>((after '1e11' 3.600.000)))
    (expect-eq !>(`(unit @ud)``3.600.000) !>((after '1e10' 3.600.000)))
    (expect-eq !>(`(unit @ud)``3.000) !>((after '3e3' 3.600.000)))
    (expect-eq !>(`(unit @ud)``3.600.000) !>((after '1E+0009999' 3.600.000)))
    (expect-eq !>(`(unit @ud)``1) !>((after '1e-9999999999' 3.600.000)))
    (expect-eq !>(`(unit @ud)`~) !>((after '0.0e-9999999999' 3.600.000)))
    (expect-eq !>(`(unit @ud)``1) !>((after '1e-0000' 3.600.000)))
    ::  Zero is zero however it is spelled, and a long fraction is small.
    (expect-eq !>(`(unit @ud)`~) !>((after '0e1000' 3.600.000)))
    (expect-eq !>(`(unit @ud)`~) !>((after '0.000000000000000000000000000' 3.600.000)))
    (expect-eq !>(`(unit @ud)``1) !>((after '0.0000000000000000000000001' 3.600.000)))
    (expect-eq !>(`(unit @ud)``2) !>((after '1.0000000000000000000000001' 3.600.000)))
    (expect-eq !>(`(unit @ud)``10) !>((after '0.0000000000000000000000001e26' 3.600.000)))
  ::
    %+  expect-eq  !>(`(unit @ud)``3.600.000)
    !>((after '100000000000000000000000000000' 3.600.000))
  ::
    %+  expect-eq  !>(|)
    !>  retryable:(parse '{"code":"quota_exceeded","retryable":"yes"}' 3.600.000)
  ::
    %+  expect-eq  !>(`(unit @t)`~)
    !>  scope:(parse '{"code":"quota_exceeded","scope":3}' 3.600.000)
  ==
::
::  Under a 200 nothing about the status says to repeat, so every unreadable
::  body here is final; the one with no body at all is a bodyless 503, which
::  the status alone makes retryable.
::
++  test-broker-error-falls-back-when-unreadable
  ;:  weld
    %+  expect-eq
      !>  ^-  [message=@t =broker-error:b]
      ['nope' ['unknown' | ~ ~]]
    !>((broker-error:util (res '{"message":"nope"}') 3.600.000))
  ::
    %+  expect-eq
      !>  ^-  [message=@t =broker-error:b]
      ['storage refused the upload' ['unknown' | ~ ~]]
    !>((broker-error:util (res 'not json at all') 3.600.000))
  ::
    %+  expect-eq
      !>  ^-  [message=@t =broker-error:b]
      ['storage refused the upload' ['unknown' & ~ ~]]
    !>((broker-error:util [%finished [503 ~] ~] 3.600.000))
  ::
    %+  expect-eq
      !>  ^-  [message=@t =broker-error:b]
      ['storage refused the upload' ['unknown' | ~ ~]]
    !>((broker-error:util (res '{"code":7,"message":7}') 3.600.000))
  ::
    %+  expect-eq
      !>  ^-  [message=@t =broker-error:b]
      ['the storage request was cancelled' ['outcome_unknown' & ~ ~]]
    !>((broker-error:util [%cancel ~] 3.600.000))
  ==
::
::  A v1 answer lifts to v2 with no broker detail; every other arm is
::  untouched.
::
++  test-response-body-lifts
  ;:  weld
    %+  expect-eq
      !>  ^-  response-body:v2:b
      [%error %unknown 'nope' ~]
    !>((response-body-1-to-2:util [%error %unknown 'nope']))
  ::
    %+  expect-eq
      !>  ^-  response-body:v2:b
      [%pending ~]
    !>((response-body-1-to-2:util [%pending ~]))
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
::
++  capacity-res
  |=  body=@t
  ^-  client-response:iris
  [%finished [200 ~] `['application/json' [(met 3 body) body]]]
::
++  test-broker-capacity-reads-the-four-fields
  %+  expect-eq
    !>  ^-  (unit capacity:b)
    `[123 4 99 (silt ~['image/png' 'application/pdf'])]
  !>  %-  broker-capacity:util
  (capacity-res '{"bytes":123,"files":4,"maxObjectBytes":99,"mimeTypes":["image/png","application/pdf"]}')
::
++  test-broker-capacity-accepts-an-empty-mime-list
  %+  expect-eq
    !>(`(unit capacity:b)``[0 0 1 ~])
  !>((broker-capacity:util (capacity-res '{"bytes":0,"files":0,"maxObjectBytes":1,"mimeTypes":[]}')))
::
++  test-broker-capacity-rejects-a-partial-or-malformed-body
  ;:  weld
    %+  expect-eq
      !>(`(unit capacity:b)`~)
    !>((broker-capacity:util (capacity-res '{"bytes":1,"files":1,"mimeTypes":[]}')))
  ::
    %+  expect-eq
      !>(`(unit capacity:b)`~)
    !>((broker-capacity:util (capacity-res '{"bytes":"1","files":1,"maxObjectBytes":1,"mimeTypes":[]}')))
  ::
    %+  expect-eq
      !>(`(unit capacity:b)`~)
    !>((broker-capacity:util (capacity-res '{"bytes":-1,"files":1,"maxObjectBytes":1,"mimeTypes":[]}')))
  ::
    %+  expect-eq
      !>(`(unit capacity:b)`~)
    !>((broker-capacity:util (capacity-res '{"bytes":1,"files":1,"maxObjectBytes":1,"mimeTypes":[7]}')))
  ::
    %+  expect-eq
      !>(`(unit capacity:b)`~)
    !>((broker-capacity:util [%cancel ~]))
  ==
--

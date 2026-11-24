/+  *test, copy=harness-work-copy
|%
++  test-human-reference-is-exact-and-ambiguous-references-fail
  =/  id  'w-192795150078560683588837229400002435572'
  =/  token  (ref:copy 't' id)
  =/  collision  (mole |.((resolve:copy 't' token ~[id token])))
  ;:  weld
      (expect-eq !>(id) !>((resolve:copy 't' token ~[id])))
      (expect-eq !>(~) !>(collision))
      (expect !>((lth (met 3 token) 12)))
  ==
++  test-approval-key-binds-hidden-canonical-fields
  =/  a
    %-  need
    (de:json:html '{"id":"0v3","action":"project-edit","args":{"id":"task","version":1}}')
  =/  b
    %-  need
    (de:json:html '{"id":"0v3","action":"project-edit","args":{"id":"task","version":2}}')
  (expect !>(!=((key:copy a) (key:copy b))))
++  test-delivery-uncertainty-is-not-presented-as-success
  =/  queued
    %-  need
    %-  de:json:html
    '{"id":"0v3","action":"task-reply","status":"done","args":{},"delivery":{"status":"pending","address":"dm/alice"}}'
  =/  uncertain
    %-  need
    %-  de:json:html
    '{"id":"0v3","action":"task-reply","status":"done","args":{},"delivery":{"status":"uncertain","address":"dm/alice"}}'
  ;:  weld
      (expect !>(?=(^ (find (trip 'not confirmed') (trip (summary:copy queued))))))
      (expect !>(?=(^ (find (trip 'could not be verified') (trip (summary:copy uncertain))))))
  ==
++  test-review-preserves-full-document-content
  =/  preview
    %-  need
    %-  de:json:html
    '{"id":"0v3","action":"review","status":"pending","args":{"id":"draft","accept":true},"proposal":{"content":{"title":"Packing list","body":"Exact first line.\\nSecond line.","sources":[]}}}'
  (expect !>(?=(^ (find (trip 'Exact first line.\0aSecond line.') (trip (summary:copy preview))))))
--

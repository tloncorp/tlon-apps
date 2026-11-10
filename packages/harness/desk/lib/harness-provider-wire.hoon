::  JSON and SSE operations shared by provider codecs.
|%
++  get
  |=  [object=json key=@t]
  ^-  (unit json)
  ?.  ?=(%o -.object)  ~
  (~(get by p.object) key)
::
++  str
  |=  [object=json key=@t]
  ^-  @t
  =/  value  (get object key)
  ?:(?=([~ %s *] value) p.u.value '')
::
++  num
  |=  [object=json key=@t]
  ^-  @ud
  =/  value  (get object key)
  ?.  ?=([~ %n *] value)  0
  (fall (rush p.u.value dem) 0)
::
++  put
  |=  [object=json key=@t value=json]
  ^-  json
  ?>  ?=(%o -.object)
  [%o (~(put by p.object) key value)]
::
++  append
  |=  [object=json key=@t text=@t]
  (put object key [%s (cat 3 (str object key) text)])
::
++  merge
  |=  [object=json fields=json]
  ^-  json
  ?>  &(?=(%o -.object) ?=(%o -.fields))
  :-  %o
  %+  roll  ~(tap by p.fields)
  |=  [[key=@t value=json] result=_p.object]
  (~(put by result) key value)
::  Ignore SSE framing and non-JSON data lines, including [DONE].
::
++  events
  |=  body=@t
  ^-  (list json)
  %+  murn  (lines body)
  |=  line=tape
  ^-  (unit json)
  ?.  =("data:" (scag 5 line))  ~
  (de:json:html (crip (slag 5 line)))
::
++  lines
  |=  body=@t
  ^-  wall
  =/  text=tape  (trip body)
  =/  reversed=wall  ~
  =/  line=tape  ~
  |-
  ^-  wall
  ?~  text  (flop [(flop line) reversed])
  ?:  =(10 i.text)
    $(text t.text, reversed [(flop line) reversed], line ~)
  ?:  =(13 i.text)  $(text t.text)
  $(text t.text, line [i.text line])
::  Streaming reasoning details are fragments keyed by index, not complete
::  replacement arrays. Preserve order and metadata while joining payloads.
::
++  details
  |=  [prior=(list json) parts=(list json)]
  ^-  (list json)
  %+  roll  parts
  |=  [part=json result=_prior]
  ?>  ?=(%o -.part)
  =/  next
    %+  turn  result
    |=  old=json
    ?.  (same-detail old part)  old
    (detail old part)
  ?:  (lien result |=(old=json (same-detail old part)))  next
  (snoc result part)
::
++  same-detail
  |=  [old=json part=json]
  =/  index  (get part 'index')
  ?:  ?=([~ %n *] index)  =(index (get old 'index'))
  =/  id  (str part 'id')
  &(!=('' id) =(id (str old 'id')))
::
++  detail
  |=  [old=json part=json]
  ?>  ?=(%o -.part)
  ::  A null metadata delta does not erase a signature or ID already received.
  =.  part
    :-  %o
    %-  ~(gas by *(map @t json))
    %+  skim  ~(tap by p.part)
    |=  [key=@t value=json]
    !=(~ value)
  =/  result  (merge old part)
  %+  roll  `(list @t)`~['text' 'summary' 'data' 'signature']
  |=  [key=@t result=_result]
  =/  value  (get part key)
  ?.  ?=([~ %s *] value)  result
  (put result key [%s (cat 3 (str old key) p.u.value)])
--

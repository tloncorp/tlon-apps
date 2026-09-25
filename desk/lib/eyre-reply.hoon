::  eyre-reply: answering an HTTP request, for agents that serve one.
::
::  None of this is about any particular agent: it is the shape eyre expects
::  back, and one wrinkle in the shape of the path it hands in. %notes and
::  %buckets both grew their own copy, identical line for line, which is the
::  argument for it living in one place -- a reply that is subtly wrong is a
::  request that hangs rather than an error anyone sees.
::
|%
+$  card  card:agent:gall
::  +reply: the three gifts one eyre request is answered with.
::
::  Header, body, then the kick that closes it. All three go on the same
::  /http-response/[eyre-id] path, and eyre holds the connection open until
::  the kick arrives -- so a reply that emits the first two and not the third
::  is a client waiting forever on a request the agent considers finished.
::
++  reply
  |=  [eyre-id=@ta code=@ud ct=@t body=@t]
  ^-  (list card)
  =/  data=octs  (as-octs:mimes:html body)
  :~  :+  %give  %fact
      :+  [/http-response/[eyre-id]]~  %http-response-header
      !>(`response-header:http`[code ~[['content-type' ct]]])
    ::
      :+  %give  %fact
      [[/http-response/[eyre-id]]~ %http-response-data !>(`data)]
    ::
      [%give %kick [/http-response/[eyre-id]]~ ~]
  ==
::  +error: a non-200 with a plain-text body.
::
++  error
  |=  [eyre-id=@ta code=@ud message=@t]
  ^-  (list card)
  (reply eyre-id code 'text/plain' message)
::  +json-reply: a 200 carrying an encoded JSON body.
::
++  json-reply
  |=  [eyre-id=@ta jon=json]
  ^-  (list card)
  (reply eyre-id 200 'application/json' (en:json:html jon))
::  +rejoin-ext: put back the "file extension" the path parser split off.
::
::  A @uv carries dots, so +parse-request-line reads the trailing dot-group of
::  /v1/request/0v1.2345 as an extension and hands back a shorter path. Left
::  alone, most ids resolve to a different request and 404. Both agents that
::  serve a @uv in a path hit this.
::
::  Reattached by flopping rather than with snip/rear: those are wet gates,
::  and handing one a list already narrowed to non-empty breaks its own
::  recursive call on the tail.
::
++  rejoin-ext
  |=  [pax=(list @t) ext=(unit @ta)]
  ^-  (list @t)
  ?~  ext  pax
  =/  back=(list @t)  (flop pax)
  ?~  back  pax
  %-  flop
  [(rap 3 i.back '.' u.ext ~) t.back]
--

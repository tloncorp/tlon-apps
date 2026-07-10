::  branch: update a lure invite deep link in branch.io
::
/-  spider, reel
/+  io=strandio, logs
::
=+  branch-key='key_live_hubypwhuxR6vkwKfdozyRoamErouusXi'
=+  branch-url='https://api2.branch.io/v1/url'
=+  base-url='https://join.tlon.io'
=+  retry=3
=+  retry-delay=~s5
::
=,  strand=strand:spider
^-  thread:spider
|^
|=  arg=vase
=/  m  (strand ,vase)
^-  form:m
=+  !<(arg=(unit [=token:reel update=metadata:reel]) arg)
?>  ?=(^ arg)
=*  token  token.u.arg
=*  update  update.u.arg
::
=+  invite-url=`@t`(rap 3 base-url '/' token ~)
;<  =bowl:strand  bind:m  get-bowl:io
::  push the update to the invite service's first-party record.
::  non-fatal: the branch update below proceeds regardless.
::
;<  branch-secret=@t  bind:m  (scry:io @t %gx /bait/branch-secret/noun)
=/  push-body=json
  =/  update-fields=(map @t json)
    (~(run by fields.update) |=(=@t s+t))
  %-  pairs:enjs:format
  ~[['token' s+token] ['fields' o+update-fields]]
=/  push=request:http
  :*  %'POST'
      'https://serverless-infra.vercel.app/api/inviteUpdate'
      :~  ['content-type' 'application/json']
          ['authorization' (cat 3 'Bearer ' branch-secret)]
      ==
      `(as-octs:mimes:html (en:json:html push-body))
  ==
;<  rep=(unit client-response:iris)  bind:m  (send-request-soft push)
;<  ~  bind:m
  =/  n  (strand ,~)
  ^-  form:n
  ?:  ?&  ?=([~ %finished *] rep)
          =(200 status-code.response-header.u.rep)
      ==
    (pure:n ~)
  =/  code=tape
    ?:  ?=([~ %finished *] rep)
      "http {<status-code.response-header.u.rep>}"
    "no response"
  =/  =log-event:logs
    :-  %tell
    :-  %warn
    :~  leaf+"failed to push invite metadata to invite service"
        leaf+"token: {(trip token)}"
        leaf+code
    ==
  (poke:io [our.bowl %logs] log-action+!>([%log log-event ~]))
::  read deep link metadata
::
=/  read=request:http
  :*  %'GET'
      %-  crip  "{(trip branch-url)}?".
                "branch_key={(trip branch-key)}&".
                "url={(en-urlt:html (trip invite-url))}"
      ~['content-type'^'application/json']
      ~
  ==
;<  =client-response:iris  bind:m  (send-request-retry read)
?>  ?=(%finished -.client-response)
=*  status-code  status-code.response-header.client-response
?.  =(200 status-code.response-header.client-response)
  =/  body=tape
    ?^  full-file.client-response
      (trip `@t`q.data.u.full-file.client-response)
    ""
  =/  =log-event:logs
    :-  %tell
    :-  %warn
    :~  leaf+"failed to read lure invite branch metadata"
        leaf+"token: {(trip token)}"
        leaf+"http {<status-code>}"
        leaf+body
    ==
  ;<  =bowl:strand  bind:m  get-bowl:io
  ;<  ~  bind:m
    (poke:io [our.bowl %logs] log-action+!>([%log log-event ~]))
  (pure:m !>(`(crip "failed to read link metadata: HTTP {<status-code>}")))
?>  ?=(^ full-file.client-response)
=/  metadata=(unit json)  (de:json:html q.data.u.full-file.client-response)
?~  metadata
  (pure:m !>(`(crip "failed to parse link metadata")))
::  retrieve the secret from the bait provider
::
;<  branch-secret=@t  bind:m  (scry:io @t %gx /bait/branch-secret/noun)
::  update the metadata fields
::
?>  ?=(%o -.u.metadata)
=*  meta  p.u.metadata
=/  data=$>(%o json)
  =-  ?>(?=(%o -.-) -)
  (~(got by meta) 'data')
=.  p.data
  %-  ~(uni by p.data)
  ^-  (map @t json)
  (~(run by fields.update) |=(=@t s+t))
=.  meta  (~(put by meta) 'data' data)
=.  meta  (~(put by meta) 'branch_key' s+branch-key)
=.  meta  (~(put by meta) 'branch_secret' s+branch-secret)
::  below parameters can't be updated, see
::  https://help.branch.io/apidocs/deep-linking-api#update-existing-deep-link.
::
=.  meta  (~(del by meta) 'alias')
=.  meta  (~(del by meta) 'identity')
=.  meta  (~(del by meta) 'type')
=.  meta  (~(del by meta) 'app_id')
=.  meta  (~(del by meta) 'randomized_bundle_token')
=.  meta  (~(del by meta) 'domain')
=.  meta  (~(del by meta) 'state')
=.  meta  (~(del by meta) 'creation_source')
=/  write=request:http
  :*  %'PUT'
      %-  crip  "{(trip branch-url)}?".
                "url={(en-urlt:html (trip invite-url))}"
      ~['content-type'^'application/json']
      `(as-octs:mimes:html (en:json:html u.metadata))
  ==
::  write the updated metadata
::
;<  =client-response:iris  bind:m  (send-request-retry write)
?>  ?=(%finished -.client-response)
=*  status-code  status-code.response-header.client-response
?.  =(200 status-code.response-header.client-response)
  =/  body=tape
    ?^  full-file.client-response
      (trip `@t`q.data.u.full-file.client-response)
    ""
  =/  =log-event:logs
    :-  %tell
    :-  %warn
    :~  leaf+"failed to update lure invite branch metadata"
        leaf+"token: {(trip token)}"
        leaf+"http {<status-code>}"
        leaf+body
    ==
  ;<  ~  bind:m
    (poke:io [our.bowl %logs] log-action+!>([%log log-event ~]))
  (pure:m !>(`(crip "failed to update link metadata: {<status-code>}")))
(pure:m !>(~))
::
++  send-request-retry
  |=  =request:http
  =/  m  (strand client-response:iris)
  ^-  form:m
  =|  response=client-response:iris
  |-
  ?:  =(0 retry)
    (pure:m response)
  ;<  ~  bind:m  (send-request:io request)
  ;<  =client-response:iris  bind:m  take-client-response:io
  ?>  ?=(%finished -.client-response)
  ?:  =(200 status-code.response-header.client-response)
    (pure:m client-response)
  =*  status-code  status-code.response-header.client-response
  ;<  ~  bind:m  (sleep:io retry-delay)
  $(retry (dec retry), response client-response)
::  +send-request-soft: request that must never fail the strand
::
::    the invite-service push is best-effort: a runtime cancellation or
::    exhausted retries return ~ so the branch update below still runs,
::    where take-client-response would fail the whole thread on %cancel
::
++  send-request-soft
  |=  =request:http
  =/  m  (strand (unit client-response:iris))
  ^-  form:m
  =/  tries  retry
  |-
  ;<  ~  bind:m  (send-request:io request)
  ;<  rep=(unit client-response:iris)  bind:m  take-maybe-response:io
  ?:  ?&  ?=([~ %finished *] rep)
          =(200 status-code.response-header.u.rep)
      ==
    (pure:m rep)
  ?:  (lte tries 1)
    (pure:m rep)
  ;<  ~  bind:m  (sleep:io retry-delay)
  $(tries (dec tries))
--

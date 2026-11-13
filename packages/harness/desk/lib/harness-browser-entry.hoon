::  The Kernel MCP result carries the private viewer capability. Only the
::  Messenger card and the service's result request receive that capability.
/-  h=harness
/+  w=harness-provider-wire, media=harness-tlon-media
|%
+$  prepared  [blob=@t result-url=@t]
+$  saved-login  [form=@t record=json bindings=json]
+$  selection  $%([%manual fields=(list json)] [%saved login=saved-login])
::
++  arguments
  |=  [name=@t raw=@t]
  ^-  [session=@t selected=selection]
  =/  args  (need (de:json:html raw))
  =/  session  (str:w args 'session_id')
  ?>  &(!=('' session) (lte (met 3 session) 128))
  ?:  =('browser_approve_login' name)
    =/  form  (str:w args 'form_id')
    ?>  (uuid form)
    =/  choice  (need (get:w args 'record'))
    =/  id  (str:w choice 'id')
    =/  revision  (num:w choice 'revision')
    ?>  &(!=('' id) (lte (met 3 id) 128) (gth revision 0) (lth revision (bex 53)))
    =/  record  (pairs:enjs:format ~[['id' %s id] ['revision' (need (get:w choice 'revision'))]])
    =/  bindings  (need (get:w args 'bindings'))
    ?>  &(?=(%a -.bindings) ?=(^ p.bindings) (lte (lent p.bindings) 2))
    :-  session
    :-  %saved
    :+  form  record
    :-  %a
    %+  turn  p.bindings
    |=  binding=json
    ^-  json
    =/  source  (str:w binding 'sourceField')
    =/  target  (str:w binding 'targetField')
    ?>  &(!=('' source) (lte (met 3 source) 64) (lte 2 (met 3 target)) (lte (met 3 target) 3))
    (pairs:enjs:format ~[['sourceField' %s source] ['targetField' %s target]])
  =/  markers  (need (get:w args 'markers'))
  ?>  ?=(%a -.markers)
  ?>  &(!=(~ p.markers) (lte (lent p.markers) 40))
  ?>  =((lent p.markers) ~(wyt in (silt p.markers)))
  :-  session
  :-  %manual
  %+  turn  p.markers
  |=  value=json
  ^-  json
  ?>  ?=(%s -.value)
  ?>  &(!=('' p.value) (lte (met 3 p.value) 128))
  ?>  (levy (trip p.value) token-char)
  (pairs:enjs:format ~[['name' %s (cat 3 'tlon-mark:' p.value)]])
::
++  request
  |=  [server=mcp-server:h session=@t selected=selection]
  ^-  request:http
  =/  fields=(list [@t json])  ~[['session_id' %s session] ['action' %s 'prepare_form']]
  =.  fields  ?-(selected [%manual *] [['fields' %a fields.selected] fields], [%saved *] [['form_id' %s form.login.selected] fields])
  (mcp-request server 'browser_session_live_view' fields)
::
++  authorize
  |=  [server=mcp-server:h session=@t login=saved-login]
  ^-  request:http
  %:  mcp-request  server  'browser_login'
    :~  ['session_id' %s session]  ['action' %s 'use']  ['form_id' %s form.login]
        ['record' record.login]  ['bindings' bindings.login]
    ==
  ==
::
++  mcp-request
  |=  [server=mcp-server:h name=@t args=(list [@t json])]
  ^-  request:http
  =/  params
    %-  pairs:enjs:format
    ~[['name' %s name] ['arguments' (pairs:enjs:format args)]]
  =/  body
    %-  pairs:enjs:format
    :~  ['jsonrpc' %s '2.0']  ['id' %n '1']
        ['method' %s 'tools/call']  ['params' params]
    ==
  :*  %'POST'
      url.server
      (weld headers.server ~[['Content-Type' 'application/json'] ['Accept' 'application/json, text/event-stream']])
      `(as-octs:mimes:html (en:json:html body))
  ==
::
++  metadata
  |=  [session=@t body=@t]
  ^-  json
  =/  details  (mcp-details body)
  ?>  =(session (str:w details 'session_id'))
  details
::
++  mcp-details
  |=  body=@t
  ^-  json
  =/  parsed  (de:json:html body)
  =/  reply
    ?^  parsed  u.parsed
    =/  replies  (skim (events:w body) |=(item=json =(`[%n '1'] (get:w item 'id'))))
    ?>  =(1 (lent replies))
    (snag 0 replies)
  ?>  &(=(`[%n '1'] (get:w reply 'id')) =('2.0' (str:w reply 'jsonrpc')))
  =/  result  (need (get:w reply 'result'))
  ?>  !=(`[%b &] (get:w result 'isError'))
  (need (get:w result 'structuredContent'))
::
++  approval-required
  |=  [session=@t body=@t]
  ^-  ?
  =/  details  (metadata session body)
  =('approval_required' (str:w (need (get:w details 'login')) 'status'))
::
++  payment-arguments
  |=  raw=@t
  ^-  [session=@t args=(list [@t json])]
  =/  args  (need (de:json:html raw))
  =/  payment  (need (de:json:html (str:w args 'arguments')))
  ?>  ?=(%o -.payment)
  =/  session  (str:w payment 'session_id')
  ?>  !=('' session)
  [session ~(tap by p.payment)]
::
++  wallet-reply
  |=  [session=(unit @t) body=@t]
  ^-  [id=@t status=@t owner=?]
  =/  details  ?~(session (mcp-details body) (metadata u.session body))
  =/  status  (str:w details 'status')
  ?:  &(?=(~ session) =('connected' status) =('link' (str:w details 'provider')))
    ['' status |]
  ?>  =(?~(session 'connect' 'payment') (str:w details 'kind'))
  =/  id  (str:w details 'request_id')
  ?>  (uuid id)
  [id status =(`[%b &] (get:w details 'owner_action_required'))]
::
++  wallet-card
  |=  id=@t
  ^-  @t
  =/  card  (pairs:enjs:format ~[['type' %s 'browser-wallet'] ['version' %n '1'] ['requestId' %s id]])
  (en:json:html [%a ~[card]])
::
++  wallet-outcome
  |=  [connect=? status=@t]
  ^-  (unit @t)
  ?:  connect
    ?+  status  ~
      %'connected'  `'Stripe Link is connected. Check the checkout and request separate payment approval.'
      %'cancelled'  `'The owner cancelled the Stripe Link connection.'
      %'expired'  `'The Stripe Link connection request expired.'
      %'failed'  `'The Stripe Link connection failed.'
      %'unknown'  `'The Stripe Link connection outcome is uncertain. Check wallet_status before trying again.'
    ==
  ?+  status  ~
    %'ready'  `'The owner approved the reviewed checkout. Check payment_status for the payment source. For Link, fill the approved card fields before submitting. Recheck the order and verify the confirmation.'
    %'filled'  `'Payment fields were filled. Inspect the page and confirm the order status.'
    %'cancelled'  `'The owner cancelled payment approval.'
    %'expired'  `'Payment approval expired.'
    %'failed'  `'Payment approval failed.'
    %'unknown'  `'The payment outcome is uncertain. Inspect the checkout or order history before taking another action.'
  ==
::
++  uuid
  |=  id=@t
  ^-  ?
  =/  chars  (trip id)
  ?.  =(36 (lent chars))  |
  %+  levy  (gulf 0 35)
  |=  index=@ud
  =/  char  (snag index chars)
  ?:  |(=(8 index) =(13 index) =(18 index) =(23 index))  =('-' char)
  |(&((gte char '0') (lte char '9')) &((gte char 'a') (lte char 'f')))
::
++  prepare-reply
  |=  [session=@t local=? selected=selection body=@t]
  ^-  prepared
  =/  details  (metadata session body)
  =/  viewer  (str:w details 'viewer_url')
  =/  result-url  (result-endpoint viewer local)
  =/  fields=(list [@t json])
    :~  ['type' %s 'browser-secure-entry']
        ['version' %n '1']
        ['viewerUrl' %s viewer]
    ==
  =?  fields  ?=(%saved -.selected)
    [['loginApproval' (pairs:enjs:format ~[['record' record.login.selected]])] fields]
  =/  card  (get:w details 'card')
  =?  fields  ?=(^ card)
    =/  purpose  (str:w u.card 'purpose')
    =/  site  (str:w u.card 'site')
    ?.  &(|(=('login' purpose) =('otp' purpose) =('details' purpose)) (lth 0 (met 3 site)) (lte (met 3 site) 253))
      fields
    [['presentation' (pairs:enjs:format ~[['purpose' %s purpose] ['site' %s site]])] fields]
  [(en:json:html [%a ~[(pairs:enjs:format fields)]]) result-url]
::
++  token-char
  |=  c=@t
  |(&((gte c 'A') (lte c 'Z')) &((gte c 'a') (lte c 'z')) &((gte c '0') (lte c '9')) =(c '-') =(c '_'))
::
++  loopback
  |=  url=@t
  ^-  ?
  =/  parsed  (de-purl:html url)
  ?.  ?=(^ parsed)  |
  =/  host  (crip (head:en-purl:html p.u.parsed))
  |(=('http://127.0.0.1' host) =('http://127.0.0.1:' (end 3^17 host)))
::
++  result-endpoint
  |=  [viewer=@t local=?]
  ^-  @t
  ?>  &((lte (met 3 viewer) 8.192) !(lien (trip viewer) |=(c=@t |((lte c 32) (gte c 127) =(c '#') =(c '@') =(c 92)))))
  =/  parsed  (need (de-purl:html viewer))
  =/  origin  (crip (head:en-purl:html p.parsed))
  ?>  |(&(local (loopback viewer)) (trusted-origin origin))
  =/  prefix  (cat 3 origin '/s/')
  =/  width  (met 3 prefix)
  ?>  =(prefix (end [3 width] viewer))
  =/  tail=tape  (trip (rsh [3 width] viewer))
  =/  token=tape  (scag (fall (find "?" tail) (lent tail)) tail)
  =/  dot  (need (find "." token))
  ?>  (gth dot 0)
  =/  signature  (slag +(dot) token)
  ?>  &((levy (scag dot token) token-char) =(43 (lent signature)) (levy signature token-char))
  (rap 3 origin '/credential-result/' (crip token) ~)
::
++  trusted-origin
  |=  origin=@t
  ^-  ?
  ?.  =('https://' (end 3^8 origin))  |
  =/  host=tape  (trip (rsh 3^8 origin))
  =/  dot  (find "." host)
  ?~  dot  |
  ?.  |(=(".tlon.network" (slag u.dot host)) =(".test.tlon.systems" (slag u.dot host)))  |
  =/  label  (crip (scag u.dot host))
  ?.  (dns-label:media label)  |
  |(=('browser-session' label) =('session-viewer' label) &((gth u.dot 16) =('browser-session-' (end 3^16 label))))
::
++  outcome
  |=  body=@t
  ^-  (unit @t)
  =/  data  (de:json:html body)
  ?~  data  ~
  ?+  (str:w u.data 'status')  ~
    %'pending'  ~
    %'filled'
      ?:  =(`[%b &] (get:w u.data 'submitted'))
        `'Secure entry filled; submission was attempted. Inspect the page before continuing.'
      `'Secure entry filled. Inspect the page and choose the next action.'
    %'cancelled'  `'The owner cancelled secure entry.'
    %'expired'  `'Secure entry expired or is no longer available.'
    %'released'  `'The browser session ended before secure entry completed.'
    %'failed'
      ?+  (str:w u.data 'outcome')  `'Secure entry failed. Inspect the page before requesting a new form.'
        %'expired'  `'Secure entry expired or is no longer available.'
        %'unknown'  `'Secure entry outcome is uncertain. Inspect the page before taking another action.'
      ==
    %'unknown'  `'Secure entry outcome is uncertain. Inspect the page before taking another action.'
  ==
--

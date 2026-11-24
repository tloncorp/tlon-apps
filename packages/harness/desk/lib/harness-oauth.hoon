::  Device-token renewal at the HTTP boundary. The reducer and clients
::  never handle OAuth. Renew on use, five minutes before expiry: no idle polling.
::  Concurrent requests share a refresh; cancellation removes held work. A new
::  login invalidates old callbacks, and rotating both tokens is one state change.
/-  *harness-oauth
/+  auth=harness-auth
|%
+$  card  card:agent:gall
+$  result  [cards=(list card) oauth=state keys=(map @t @t) failed=(list [=wire error=@t])]
++  identity
  |=  [keys=(map @t @t) provider=@t]
  %-  sham
  :*  (key:auth keys (cat 3 provider '-device'))
      (key:auth keys (cat 3 provider '-refresh'))
      (key:auth keys (cat 3 provider '-account'))
  ==
++  client-id
  |=  provider=@t
  ?:(=('xai' provider) 'b1a00492-073a-47ea-816f-4c329264a828' 'app_EMoamEEZ73f0CkXaXp7hrann')
++  token-url
  |=  provider=@t
  ?:(=('xai' provider) 'https://auth.x.ai/oauth2/token' 'https://auth.openai.com/oauth/token')
++  saved-expiry
  |=  [keys=(map @t @t) provider=@t]
  =/  stored  (slaw %da (key:auth keys (cat 3 provider '-expires')))
  ?^(stored stored (expiry (key:auth keys (cat 3 provider '-device'))))
++  token-expiry
  |=  [body=json token=@t now=@da]
  ^-  (unit @da)
  ?>  ?=(%o -.body)
  =/  lifetime  (~(get by p.body) 'expires_in')
  ?.  ?=([~ %n *] lifetime)  (expiry token)
  =/  seconds  (rush p.u.lifetime dem)
  ?~  seconds  ~
  ?.  &((gth u.seconds 0) (lte u.seconds 31.536.000))  ~
  `(add now (mul u.seconds ~s1))
++  expiry
  |=  token=@t
  ^-  (unit @da)
  ::  Decode only an untrusted expiry hint, never use JWT claims as authority.
  =/  parts  (rush token (more dot (cook crip (plus ;~(pose hig low nud hep cab)))))
  ?~  parts  ~
  ?.  =(3 (lent u.parts))  ~
  =/  decoded  (~(de base64:mimes:html | &) (snag 1 u.parts))
  ?~  decoded  ~
  =/  claims  (de:json:html q.u.decoded)
  ?.  ?=([~ %o *] claims)  ~
  =/  expires  (~(get by p.u.claims) 'exp')
  ?.  ?=([~ %n *] expires)  ~
  =/  seconds  (rush p.u.expires dem)
  ?~  seconds  ~
  ?.  (lte u.seconds 253.402.300.799)  ~
  `(add ~1970.1.1 (mul u.seconds ~s1))
++  clear-headers
  |=  headers=header-list:http
  %+  skim  headers
  |=  [name=@t value=@t]
  !(~(has in (silt ~['authorization' 'chatgpt-account-id'])) (crip (cass (trip name))))
++  authorize
  |=  [outgoing=http-card keys=(map @t @t) provider=@t]
  ^-  card
  =.  header-list.request.outgoing
    (headers:auth keys url.request.outgoing (clear-headers header-list.request.outgoing))
  =.  header-list.request.outgoing
    :*  ['authorization' (cat 3 'Bearer ' (key:auth keys (cat 3 provider '-device')))]
        header-list.request.outgoing
    ==
  outgoing
++  fail-waiting
  |=  [out=result message=@t]
  =.  failed.out
    %+  weld  failed.out
    %+  turn  ~(tap by waiting.oauth.out)
    |=  [=wire http-card]
    [wire message]
  out(waiting.oauth ~)
++  filter
  |=  $:  incoming=(list card)
          oauth=state
          keys=(map @t @t)
          now=@da
          provider=@t
      ==
  ^-  result
  =/  out=result  [~ oauth keys ~]
  =/  id  (identity keys provider)
  =?  out  !=(id identity.oauth)
    =.  out
      %+  fail-waiting
        out
      'authentication_error: Provider login changed while waiting. Send the message again.'
    %=  out
      oauth
        %=  oauth
          identity  id
          active  ~
          expires  (saved-expiry keys provider)
          retry-at  *@da
          error  ''
          terminal  |
          waiting  ~
        ==
    ==
  ::  Also check the deadline on ordinary events, so a missed wake cannot wedge
  ::  requests across reload. A timeout fences a late token response.
  =?  out  &(?=(^ active.oauth.out) (gte now deadline.u.active.oauth.out))
    (failed-refresh out now 'Login renewal timed out. Sign in again.' &)
  =/  expired=?
    ?~(expires.oauth.out & (gte (add now ~m5) u.expires.oauth.out))
  =/  renewable=?  !=('' (key:auth keys (cat 3 provider '-refresh')))
  |-  ^-  result
      ?~  incoming
        ?.  &(expired renewable !=(~ waiting.oauth.out) ?=(~ active.oauth.out))  out
        =/  nonce  +(serial.oauth.out)
        =/  deadline=@da  (add now ~s30)
        =/  started=state
          %=  oauth.out
            serial  nonce
            active  `[nonce deadline]
          ==
        =/  fresh  (refresh-cards keys provider nonce deadline)
        :*  (weld cards.out fresh)
            started
            keys.out
            failed.out
        ==
      %=  $
        incoming  t.incoming
        out  (filter-card out i.incoming keys provider now expired renewable)
      ==
::
++  filter-card
  |=  $:  out=result
          incoming-card=card
          keys=(map @t @t)
          provider=@t
          now=@da
          expired=?
          renewable=?
      ==
  ^-  result
  ?:  ?=([%pass * %arvo %i %cancel-request *] incoming-card)
    %=  out
      waiting.oauth  (~(del by waiting.oauth.out) p.incoming-card)
      cards  (snoc cards.out incoming-card)
    ==
  ?.  ?=([%pass * %arvo %i %request *] incoming-card)
    out(cards (snoc cards.out incoming-card))
  =/  http=http-card  incoming-card
  =/  device-route
    ?:  =('xai' provider)
      (xai-route:auth url.request.http)
    (device-route:auth url.request.http)
  ?.  &(device-route |(?=([%llm *] wire.http) ?=([%models *] wire.http)))
    out(cards (snoc cards.out incoming-card))
  ?:  =('' (key:auth keys (cat 3 provider '-device')))
    =/  failure
      :*  wire.http
          'authentication_error: No device login is saved. Sign in in provider settings.'
      ==
    out(failed (snoc failed.out failure))
  ?:  |(terminal.oauth.out (lth now retry-at.oauth.out))
    out(failed (snoc failed.out [wire.http error.oauth.out]))
  ?.  expired
    out(cards (snoc cards.out (authorize http keys provider)))
  ?.  renewable
    ::  An opaque imported token without a refresh token may still be usable.
    ?:  ?~(expires.oauth.out & (lth now u.expires.oauth.out))
      out(cards (snoc cards.out (authorize http keys provider)))
    =/  failure
      :*  wire.http
          'authentication_error: Device login expired. Sign in again to enable automatic renewal.'
      ==
    out(failed (snoc failed.out failure))
  ?:  (gte (lent ~(tap by waiting.oauth.out)) 64)
    =/  failure  [wire.http 'Login renewal is busy. Try again shortly.']
    out(failed (snoc failed.out failure))
  =.  header-list.request.http  (clear-headers header-list.request.http)
  out(waiting.oauth (~(put by waiting.oauth.out) wire.http http))
::  Dispatch once: Iris must neither retry nor redirect a rotating token.
++  refresh-cards
  |=  [keys=(map @t @t) provider=@t nonce=@ud deadline=@da]
  ^-  (list card)
  =/  token  (key:auth keys (cat 3 provider '-refresh'))
  =/  body
    %+  rap  3
    :~  'grant_type=refresh_token&client_id='
        (client-id provider)
        '&refresh_token='
        (crip (en-urlt:html (trip token)))
    ==
  =/  =request:http
    :*  %'POST'
        (token-url provider)
        ~[['content-type' 'application/x-www-form-urlencoded'] ['accept' 'application/json']]
        `(as-octs:mimes:html body)
    ==
  :~  [%pass /[(cat 3 provider '-renew')]/(scot %ud nonce) %arvo %i %request request [0 0]]
      [%pass /[(cat 3 provider '-timeout')]/(scot %ud nonce) %arvo %b %wait deadline]
  ==
++  failed-refresh
  |=  [out=result now=@da message=@t terminal=?]
  =.  out  (fail-waiting out message)
  %=  out
    active.oauth  ~
    retry-at.oauth  `@da`(add now ~m1)
    error.oauth  message
    terminal.oauth  terminal
  ==
++  receive
  |=  $:  oauth=state
          keys=(map @t @t)
          now=@da
          nonce=@ud
          response=client-response:iris
          provider=@t
      ==
  ^-  result
  =/  out=result  [~ oauth keys ~]
  ?.  &(=(identity.oauth (identity keys provider)) ?=(^ active.oauth))  out
  ?.  =(nonce serial.u.active.oauth)  out
  ?:  (gte now deadline.u.active.oauth)
    (failed-refresh out now 'Login renewal timed out. Sign in again.' &)
  ?:  ?=(%progress -.response)  out
  ?:  ?=(%cancel -.response)
    (failed-refresh out now 'Login renewal was interrupted. Sign in again.' &)
  =/  status  status-code.response-header.response
  ?.  =(200 status)
    ::  Never publish the raw token response, even when the provider fails.
    =/  terminal=?
      ?|  =(400 status)
          =(401 status)
          =(403 status)
          &(=('xai' provider) !=(429 status))
      ==
    =/  message
      ?:  terminal
        'authentication_error: Device login can no longer be renewed. Sign in again in provider settings.'
      'Login renewal is temporarily unavailable. Try again shortly.'
    (failed-refresh out now message terminal)
  =/  parsed  (parse-response response now)
  ?~  parsed
    (failed-refresh out now 'Login renewal returned an invalid response. Sign in again.' &)
  =/  data=[token=@t refresh=@t expires=(unit @da)]  u.parsed
  =.  keys.out  (~(put by keys) (cat 3 provider '-device') token.data)
  =?  keys.out  !=('' refresh.data)  (~(put by keys.out) (cat 3 provider '-refresh') refresh.data)
  =.  keys.out  (~(put by keys.out) (cat 3 provider '-expires') (scot %da (need expires.data)))
  =.  cards.out
    %+  turn  ~(val by waiting.oauth)
    |=  outgoing=http-card
    (authorize outgoing keys.out provider)
  %=  out
    oauth
      %=  oauth
        identity  (identity keys.out provider)
        active  ~
        expires  expires.data
        retry-at  *@da
        error  ''
        terminal  |
        waiting  ~
      ==
  ==
::  Treat the response as untrusted input before rotating either credential.
++  parse-response
  |=  [response=client-response:iris now=@da]
  ^-  (unit [token=@t refresh=@t expires=(unit @da)])
  %-  mole
  |.
  ?>  ?=(%finished -.response)
  ?>  ?=(^ full-file.response)
  ?>  (lte p.data.u.full-file.response 262.144)
  =/  object  (need (de:json:html q.data.u.full-file.response))
  ?>  ?=([%o *] object)
  =/  token  (need (~(get by p.object) 'access_token'))
  ?>  ?=([%s *] token)
  ?>  &(!=('' p.token) (lte (met 3 p.token) 16.384))
  =/  refresh  (~(get by p.object) 'refresh_token')
  ?>  ?~(refresh & &(?=(%s -.u.refresh) !=('' p.u.refresh) (lte (met 3 p.u.refresh) 16.384)))
  =/  expires  (token-expiry object p.token now)
  ?>  ?=(^ expires)
  ?>  (gth u.expires (add now ~m5))
  [p.token ?:(?=([~ %s *] refresh) p.u.refresh '') expires]
--

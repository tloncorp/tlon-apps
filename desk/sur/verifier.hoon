::  verifier: identity verification service types
::
=/  id-type
  $%  [%dummy @t]
      [%urbit @p]
      [%phone @t]      ::  normalized phone nr, a la +31612345678
      [%twitter @t]    ::  lowercased handle
      [%website turf]  ::  domain, tld first
  ==
|*  identifier=_id-type  ::NOTE  parameterized for dbug purposes
^?
|%
+$  identifier  ^identifier
+$  state
  $:  records=(map identifier record)
      owners=(jug ship identifier)
      attested=(map @ux identifier)
      lookups=(map @ identifier)
      reverse=(jug identifier @)
    ::
      limits=[solo=(map @p allowance) pool=_allowance:pool:rates]
    ::
      ::NOTE  basic auth only needed for staging api key
      phone-api=[base=@t key=@t basic=(unit [user=@t pass=@t])]
      twitter-api=[bearer=@t]
      domain=(unit @t)  ::  as 'https://example.org:123/verifier'
  ==
::
+$  id-kind  ?(%dummy %urbit %phone %twitter %website)
::
+$  record
  $:  for=@p  ::TODO  or tmp id
      start=@da
      id-state
  ==
+$  id-state
  $:  =config
      =status
  ==
::
+$  config
  $=  discoverable  ::  owner discoverable through this id?
  $~  %hidden       ::  default
  $?  %public       ::  yes
      %hidden       ::  no
      %verified     ::  only by other same-kind verified owners
  ==
::
+$  status
  $~  [%wait ~]
  $%  [%done attestation]        ::  verified
      [%wait pre=(unit status)]  ::  service at work
      [%want user-task]          ::  waiting on user action
  ==
::
+$  user-task
  $%  [%urbit nonce=@ux]          ::  awaiting signature from other side
      [%phone %otp]               ::  awaiting otp code from user
      [%twitter %post nonce=@ux]  ::  post tweet containing $payload:twitter
      [%website %sign nonce=@ux]  ::  serve a /.well-known/urbit/tlon/verify
  ==
+$  user-work
  $%  [%urbit sig=payload:urbit]
      [%phone otp=@t]
      [%twitter %post id=@t]
      [%website %sign]
  ==
::
+$  attestation
  $:  half=(signed half-sign-data)
      full=(signed full-sign-data)
  ==
::
+$  proof
  $%  [%link @t]
      [%tweet id=@t]
      [%urbit sig=payload:urbit]
  ==
::
::TMP  410 jael vile scry type for cross-compat
+$  feed
  $^  $%  [[%1 ~] who=ship kyz=(list [lyf=life key=ring])]
          [[%2 ~] who=ship ryf=rift kyz=(list [lyf=life key=ring])]
      ==
  seed:jael
::
++  signed
  |$  dat
  $:  who=@p
      lyf=life
      dat=dat
      sig=@ux
  ==
+$  half-sign-data
  [%0 %verified %half when=@da for=@p kind=id-kind]
+$  full-sign-data
  [%0 %verified %full when=@da for=@p id=identifier proof=(unit proof)]  ::TODO  (set proof)?
+$  any-sign-data
  ?(half-sign-data full-sign-data)
::
++  urbit  ^?
  |%
  +$  payload    (signed sign-data)
  +$  sign-data  [%urbit %0 other=@p nonce=@ux]
  --
::
++  twitter  ^?
  |%
  +$  payload    (signed sign-data)
  +$  sign-data  [%twitter %0 handle=@t nonce=@ux]
  --
::
++  website  ^?
  |%
  +$  payload     (signed sign-data)
  +$  sign-data   [%website %0 =turf nonce=@ux]
  ++  well-known  '/.well-known/urbit/tlon/verify'
  --
::
+$  allowance              ::  remaining "request token" balance
  $:  since=@da            ::  time of last request
      phone=$~(5 @ud)      ::  remaining text msgs
      photp=$~(5 @ud)      ::  remaining otp submission attempts
      tweet=$~(3 @ud)      ::  remaining tweet verification attempts
      fetch=$~(5 @ud)      ::  remaining website challenge fetches
      queries=$~(100 @ud)  ::  remaining queries
      batch=$~(1.000 @ud)  ::  remaining new %whose-bulk entries
      last-batch=@ux       ::  previous batch set salted hash
  ==
++  rates  ::  re-fill allowance by n per p
  |%
  ++  phone    [n=1 p=~d1]   ::NOTE  hosting allows 1/min, up to 5/hour
  ++  photp    [n=1 p=~m1]   ::NOTE  code rotates every 10 minutes
  ++  tweet    [n=1 p=~m15]  ::NOTE  twitter api @ 15/15m in total
  ++  fetch    [n=1 p=~m1]
  ++  queries  [n=1 p=~m5]
  ++  batch    [n=10 p=~d1]
  ::
  ++  batch-upper-bound  10.000
  ::
  ++  pool
    |%
    ++  allowance
      ^-  ^allowance
      :*  since=*@da
          phone=50
          photp=1.000
          tweet=10
          fetch=50
          queries=100
          batch=1.000
          last-batch=*@ux
      ==
    ::
    ++  phone    [n=1 p=~m5]
    ++  photp    [n=10 p=~m1]
    ++  tweet    [n=5 p=~m15]
    ++  fetch    [n=10 p=~m1]
    ++  queries  [n=10 p=~m5]
    ++  batch    [n=10 p=~d1]
    --
  --
::
::
+$  user-command
  $%  [%start id=identifier]
      [%config id=identifier =config]
      [%revoke id=identifier]
      [%work id=identifier work=user-work]
  ==
+$  host-command
  $%  [%revoke id=identifier]
      [%dummy id=@t do=?(%grant %reject)]
  ==
::
+$  update
  $%  [%full all=(map identifier id-state)]
      [%status id=identifier why=@t status=$%([%gone ~] status)]
      [%config id=identifier =config]
      [%endpoint base=(unit @t)]
  ==
::
++  user-query
  |^  ,[[=dude:gall nonce=@] query]
  +$  query
    $%  [%has-any who=@p kind=id-kind]
        [%valid sig=@ux]
        [%whose id=identifier]
      ::
        $:  %whose-bulk
            last-salt=@ux
            last=(set identifier)
            add=(set identifier)
            del=(set identifier)
        ==
    ==
  --
++  query-result
  |^  ,[nonce=@ result]
  +$  result
    $%  [%rate-limit ~]
        [%has-any has=?]
        [%valid valid=?]
        [%whose who=(unit @p)]
        [%whose-bulk next-salt=@ux who=(map identifier (unit @p))]  ::REVIEW  or just absence?
    ==
  --
::
++  l  ::  lanyard
  |%
  +$  command
    $:  host=(unit @p)
    $%  user-command
        [%work-for %urbit for=@p nonce=@ux]
        [%profile id=identifier show=?(%full %half %none)]
    ==  ==
  ::
  +$  query
    $:  host=(unit @p)
        nonce=(unit @)
        query=question
    ==
  +$  question
    $%  [%valid-jam jam=@uw]  ::  jammed $signed
        query:user-query
    ==
  +$  result
    $~  [%fail 'bunt']
    $%  [%fail why=@t]
        [%valid-jam valid=$@(sig=? [sig=? liv=?])]
        $<(%rate-limit result:query-result)
    ==
  ::
  +$  update
    $%  [%query nonce=@ result]
        [%status [host=@p id=identifier] why=@t status=$%([%gone ~] status)]
        [%config [host=@p id=identifier] =config]
        [%full all=(map [host=@p id=identifier] [=config why=@t =status])]
    ==
  --
--

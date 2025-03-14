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
      ::NOTE  basic auth only for staging
      phone-api=[base=@t key=@t basic=(unit [user=@t pass=@t])]
      twitter-api=[bearer=@t]
      domain=(unit @t)  ::  as 'https://example.org:123'
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
+$  attestation
  $:  half=(signed half-sign-data)
      full=(signed full-sign-data)
  ==
::
+$  proof
  $%  [%link @t]
      [%tweet id=@t]
  ==
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
++  rates  ::REVIEW
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
+$  user-task
  $%  [%urbit pin=@]              ::  awaiting confirmation from other side
      [%phone %otp]               ::  awaiting otp code from user
      [%twitter %post nonce=@ux]  ::  post tweet containing $payload:twitter
      [%website %sign nonce=@ux]  ::  serve a /.well-known/urbit/tlon/verify
  ==
+$  user-work
  $%  [%urbit pin=@]
      [%phone otp=@t]
      [%twitter %post id=@t]
      [%website %sign]
  ==
::
::
+$  user-command
  $%  [%start id=identifier]  ::  nonce for subscription updates
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
    $%  [%has-any has=?]
        [%valid valid=?]
        [%whose who=(unit @p)]
        [%whose-bulk next-salt=@ux who=(map identifier (unit @p))]  ::REVIEW  or just absence?
    ==
  --
::
::REVIEW  i don't think we need the client to bring their own nonces, right?
::        just let these be for internal comms only, hold the client's hand
::        through that and just deliver them the status updates as they happen..
++  l  ::  lanyard  ::TODO  separate file
  |%
  +$  command
    $:  host=(unit @p)
    $%  user-command
        [%profile id=identifier show=?(%full %half %none)]
    ==  ==
  +$  query    [host=(unit @p) nonce=(unit @) query=question]
  +$  question
    $%  [%valid-jam @uw]  ::  jammed $signed
        query:user-query
    ==
  +$  result
    $%  [%fail why=@t]
        [%valid-jam valid=$@(sig=? [sig=? liv=?])]
        result:query-result
    ==
  +$  update
    $%  [%query nonce=@ result]  ::TODO  different?
        [%status [host=@p id=identifier] why=@t status=$%([%gone ~] status)]
        [%config [host=@p id=identifier] =config]
        [%full all=(map [host=@p id=identifier] [=config why=@t =status])]
    ==
  --
--

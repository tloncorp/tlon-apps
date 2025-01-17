::  verifier: identity verification service types
::
|%
+$  state
  $:  records=(map identifier record)
      owners=(jug ship identifier)
      attested=(map @ux identifier)
    ::
      limits=(map @p allowance)
    ::
      ::NOTE  basic auth only for staging
      phone-api=[base=@t key=@t basic=(unit [user=@t pass=@t])]
      twitter-api=[bearer=@t]
      domain=(unit @t)  ::  as 'https://example.org:123'
  ==
::
+$  identifier
  $%  [%dummy @t]
      [%urbit @p]
      [%phone @t]    ::  normalized phone nr, a la +31612345678
      [%twitter @t]  ::  lowercased handle
  ==
+$  id-kind  ?(%dummy %urbit %phone %twitter)
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
+$  config       ::  owner discoverable through this id?
  $~  %hidden    ::  default
  $?  %public    ::  yes
      %hidden    ::  no
      %verified  ::  only by other same-kind verified owners
  ==
::
+$  status
  $%  [%done attestation]        ::  verified
      [%wait pre=(unit status)]  ::  service at work
      [%want user-task]          ::  waiting on user action
  ==
::
+$  attestation
  $:  when=@da  ::TODO  redundant with signs?
      proof=(unit proof)  ::TODO  set?  ::TODO  redundant with full-sign?
      half-sign=(urbit-signature half-sign-data-0)
      full-sign=(urbit-signature full-sign-data-0)
  ==
::
+$  proof
  $%  [%link @t]
      [%tweet id=@t]
  ==
::
++  urbit-signature
  |$  dat
  $:  who=@p
      lyf=life
      dat=dat
      sig=@ux
  ==
+$  half-sign-data-0
  [%0 %verified when=@da for=@p kind=id-kind]
+$  full-sign-data-0
  [%0 %verified when=@da for=@p id=identifier proof=(unit proof)]
::
++  twitter
  |%
  +$  payload      (urbit-signature sign-data-0)
  +$  sign-data-0  [%twitter %0 handle=@t nonce=@ux]
  --
::
+$  allowance         ::  remaining "request token" balance
  $:  since=@da       ::  time of last request
      phone=_5        ::  remaining text msgs
      queries=_100    ::  remaining queries
      batch=_1.000    ::  remaining new %whose-bulk entries  ::TODO  use .queries?
      last-batch=@ux  ::  previous batch set salted hash
  ==
++  rates  ::REVIEW
  |%
  ++  phone    [n=1 p=~d1]  ::NOTE  hosting allows 1/min, up to 5/hour
  ++  queries  [n=1 p=~m5]
  ++  batch    [n=10 p=~d1]
  ::
  ++  batch-upper-bound  10.000
  --
::
::
+$  user-task
  $%  [%urbit pin=@]              ::  awaiting confirmation from other side
      [%phone %otp]               ::  awaiting otp code from user
      [%twitter %post nonce=@ux]  ::  post tweet containing signed dat
  ==
+$  user-work
  $%  [%urbit pin=@]
      [%phone otp=@t]
      [%twitter %post id=@t]
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
      [%status id=identifier status=$%([%gone why=@t] status)]
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
  +$  command  [host=(unit @p) user-command]
  +$  query    [host=(unit @p) nonce=(unit @) query=question]
  +$  question
    $%  [%valid-jam @uw]  ::  jammed $urbit-signature
        query:user-query
    ==
  +$  result
    $%  [%fail why=@t]
        [%valid-jam valid=$@(sig=? [sig=? liv=?])]
        result:query-result
    ==
  +$  update
    $%  [%query nonce=@ result]  ::TODO  different?
        [%status [host=@p id=identifier] status=$%([%gone why=@t] status)]
        [%config [host=@p id=identifier] =config]
        [%full all=(map [host=@p id=identifier] id-state)]
    ==
  --
--

::  verifier: identity verification service types
::
|%
+$  state
  $:  records=(map identifier record)
      owners=(jug ship identifier) 
      attested=(map @ux identifier)
      ::TODO  need attestation for [@p id-kind], for profile exposing
      ::TODO  (map identifier host-work) ? or would that be only for %dummy?
      ::NOTE  basic auth only for staging
      phone-api=[base=@t key=@t basic=(unit [user=@t pass=@t])]
      :: :verifier [%set-phone-api 'https://test.tlon.systems/v1/vnd' 'jBn9iZC.yJtz2xoZ3m@sk7N3GQRWcinrfU' ~ 'tlon' 'hidruc-folrup-mismut']
      domain=(unit @t)  ::  as 'https://example.org:123'
  ==
::
+$  identifier
  $%  [%dummy @t]
      [%urbit @p]
      [%phone @t]
  ==
+$  id-kind  ?(%dummy %urbit %phone)
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
  $%  [%done attestation]  ::  verified
      [%wait ~]            ::  service at work
      [%want user-task]    ::  waiting on user action
  ==
::
+$  attestation
  $:  when=@da
      proof=(unit proof)  ::TODO  set?
      half-sign=(urbit-signature half-sign-data-0)
      full-sign=(urbit-signature full-sign-data-0)
  ==
::
+$  proof
  $%  [%link @t]
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
+$  user-task
  $%  [%urbit pin=@]   ::  awaiting confirmation from other side
      [%phone %otp]    ::  awaiting otp code from user
  ==
+$  user-work
  $%  [%urbit pin=@]
      [%phone otp=@t]
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
+$  identifier-update  ::TODO  $verifier-update
  $%  [%full all=(map identifier id-state)]
      [%status id=identifier status=?(%gone status)]
      [%config id=identifier =config]
      [%endpoint base=(unit @t)]
  ==
::
+$  user-query
  $:  [=dude:gall nonce=@]
  $%  [%has-any who=@p kind=id-kind]
      [%valid sig=@ux]
      [%whose id=identifier]
      ::TODO  %whose-many
  ==  ==
+$  query-result
  $:  nonce=@
  $%  [%has-any has=?]
      [%valid valid=?]
      [%whose who=(unit @p)]
  ==  ==
::
::REVIEW  i don't think we need the client to bring their own nonces, right?
::        just let these be for internal comms only, hold the client's hand
::        through that and just deliver them the status updates as they happen..
++  l  ::  lanyard  ::TODO  separate file
  |%
  +$  command  [(unit host=@p) user-command]
  +$  query    [(unit host=@p) _+:*user-query]
  +$  result   $@(%fail _+:*query-result)
  +$  update
    $%  [%query nonce=@ result]  ::TODO  different?
        [%status [host=@p id=identifier] status=?(%gone status)]
        [%config [host=@p id=identifier] =config]
        [%full all=(map [host=@p id=identifier] id-state)]
    ==
  --
--

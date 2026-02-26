/-  s=signal
=*  z  ..zuse
|%
++  enjs
  =,  enjs:format
  |%
  ++  action
    |=  a=action:s
    %-  pairs
    :~  ship+s+(scot %p ship.a)
        action+(action-inner action.a)
    ==
  ++  action-inner
    |=  ai=action-inner:s
    %+  frond  -.ai
    ?-  -.ai
      %save-state
        %-  pairs
        :~  peer+s+(scot %p peer.ai)
            data+s+data.ai
        ==
      %save-cache
        %-  pairs
        :~  peer+s+(scot %p peer.ai)
            data+s+data.ai
        ==
      %save-credential  s+cred.ai
      %save-auth-type   s+auth-type.ai
      %publish-prekeys  (prekey-bundle bundle.ai)
    ==
  ++  prekey-bundle
    |=  pb=prekey-bundle:s
    %-  pairs
    :~  identity-pub+s+identity-pub.pb
        identity-dh-pub+s+identity-dh-pub.pb
        spk-key+s+spk-key.pb
        spk-sig+s+spk-sig.pb
    ==
  ++  auth-type
    |=  at=auth-type:s
    s+at
  --
::
++  dejs
  =,  dejs:format
  |%
  ++  action
    ^-  $-(json action:s)
    %-  ot
    :~  ship/ship
        action/action-inner
    ==
  ++  action-inner
    ^-  $-(json action-inner:s)
    %-  of
    :~  save-state/save-state
        save-cache/save-state
        save-credential/so
        save-auth-type/auth-type
        publish-prekeys/prekey-bundle
    ==
  ++  auth-type
    |=  jon=json
    ^-  auth-type:s
    ?>  ?=([%s *] jon)
    ?>  ?=(?(%passkey %passphrase) p.jon)
    p.jon
  ++  save-state
    ^-  $-(json [peer=^ship data=encrypted-state:s])
    %-  ot
    :~  peer/ship
        data/so
    ==
  ++  prekey-bundle
    ^-  $-(json prekey-bundle:s)
    %-  ot
    :~  identity-pub/so
        identity-dh-pub/so
        spk-key/so
        spk-sig/so
    ==
  ::
  ++  ship  `$-(json ship:z)`(su ship-rule)
  ++  ship-rule  ;~(pfix sig fed:ag)
  --
--

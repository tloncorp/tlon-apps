/-  s=signal
|_  =auth-type:s
++  grad  %noun
++  grow
  |%
  ++  noun  auth-type
  ++  json  s+auth-type
  --
++  grab
  |%
  ++  noun  auth-type:s
  ++  json
    |=  jon=^json
    ?>  ?=([%s *] jon)
    ?>  ?=(?(%passkey %passphrase) p.jon)
    p.jon
  --
--

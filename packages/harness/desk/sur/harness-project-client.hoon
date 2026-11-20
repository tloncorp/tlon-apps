::  Owner-issued, read-only project capabilities. Never store the bearer key.
::  Retain revoked identities so a delayed create cannot resurrect a key.
|%
+$  credential
  $:  project=@t
      label=@t
      digest=@ux
      created=@da
      expires=@da
      revoked=(unit @da)
  ==
+$  state  (map @t credential)
--

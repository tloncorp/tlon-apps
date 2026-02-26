|%
+$  action
  $:  =ship
      action=action-inner
  ==
+$  action-inner
  $%  [%save-state peer=ship data=encrypted-state]
      [%save-credential cred=credential-id]
      [%save-auth-type =auth-type]
      [%publish-prekeys bundle=prekey-bundle]
  ==
+$  encrypted-state  @t
+$  credential-id  @t
+$  auth-type  ?(%passkey %passphrase)
+$  prekey-bundle
  $:  identity-pub=@t
      identity-dh-pub=@t
      spk-key=@t
      spk-sig=@t
  ==
--

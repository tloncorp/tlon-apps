|%
+$  command
  $%  [%set-service vic=@t]
      [%set-ship civ=@p]
  ==
::
+$  bite
  $%  [%bite-0 token=@ta ship=@p]
      [%bite-1 token=@ta joiner=@p inviter=@p]
      [%bite-2 =token joiner=@p =metadata]
  ==
::
+$  token  @ta
+$  nonce  @ta
+$  field
  $?  %'bite-type'
    ::
      %'inviteType'
    ::
      %'inviterUserId'
      %'inviterNickname'
      %'inviterAvatarImage'
      %'inviterColor'
    ::
      %'invitedGroupId'
      %'invitedGroupTitle'
      %'invitedGroupDescription'
      %'invitedGroupIconImageUrl'
      %'invitedGroupDeleted'
    ::
      %'$og_title'
      %'$twitter_title'
  ==
+$  metadata  [tag=term fields=(map field cord)]
+$  confirmation  [=nonce =token]
++  v1  v1:ver
++  v0  v0:ver
++  ver
  |%
  ++  v1  .
  ++  v0
    |%
    +$  metadata  [tag=term fields=(map cord cord)]
    --
  --
--

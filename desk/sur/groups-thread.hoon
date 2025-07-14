/-  g=groups, c=channels, meta
|%
+$  create-group
  $:  group-id=flag:g
      meta=data:meta
      guests=(set ship)
      channels=(list create-channel)
  ==
+$  create-channel
  $:  channel-id=nest:c
      meta=data:meta
  ==
--


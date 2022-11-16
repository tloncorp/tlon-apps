/-  groups, graph-store, chat, post
|%
+$  id  (pair ship time)
::
+$  bags  (map flag:groups tags)
::
+$  tags  (map nest:groups dues)
::
+$  dues
  $%
    [%chat (map id:chat burr)]
  ==
::
+$  burr
  $%
    [%node =resource:post =node:graph-store]
    [%index hook]
    [%post =resource:post =maybe-post:graph-store]
  ==
::
+$  hook  [=resource:post =index:post]
+$  bait  [%grub hook]                                  :: to eat
::
+$  diff
  $%
    [%stow hook]                                        :: referred
    [%slew hook]                                        :: refers
  ==
::
+$  action  (pair id diff)
--

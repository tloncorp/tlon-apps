/-  g=groups
|%
+$  create
  $:  group=flag:g  :: TODO: unmanaged-style group chats
      name=term
      title=cord
      description=cord
      readers=(set sect:g)
      writers=(set sect:g)
  ==
::
+$  perm
  $:  writers=(set sect:g)
      group=flag:g
  ==
::
+$  leave  flag:g
--
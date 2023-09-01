::  Common types among channels
::
|%
::  $feel: either an emoji identifier like :diff or a URL for custom
+$  feel  @ta
+$  feels  (map ship (rev (unit feel)))
+$  rr-feels  (map ship feel)
::
+$  c-feel
  $%  [%add-feel id=@da p=ship q=feel]
      [%del-feel id=@da p=ship]
  ==
::
++  apply-feels
  |=  [old=feels new=feels]
  ^-  feels
  %-  (~(uno by old) new)
  |=  [* a=(rev (unit feel)) b=(rev (unit feel))]
  +:(apply-rev a b)
::
++  reduce-feels
  |=  =feels
  ^-  (map ship feel)
  %-  ~(gas by *(map ship feel))
  %+  murn  ~(tap by feels)
  |=  [=ship (rev feel=(unit feel))]
  ?~  feel  ~
  (some ship u.feel)
::
+$  a-remark
  $~  [%read ~]
  $%  [%read ~]
      [%read-at =time]
      [%watch ~]
      [%unwatch ~]
  ==
::
++  rev
  |$  [data]
  [rev=@ud data]
::
++  apply-rev
  |*  [old=(rev) new=(rev)]
  ^+  [changed=& old]
  ?:  (lth rev.old rev.new)
    &+new
  |+old
::
++  next-rev
  |*  [old=(rev) new=*]
  ^+  [changed=& old]
  ?:  =(+.old new)
    |+old
  &+old(rev +(rev.old), + new)
--

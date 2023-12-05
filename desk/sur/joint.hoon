::  Common types among channels
::
|%
::  $react: either an emoji identifier like :diff or a URL for custom
+$  react      @ta
+$  v-reacts   (map ship (rev (unit react)))
+$  reacts     (map ship react)
::
+$  c-react
  $%  [%add-react id=@da p=ship q=react]
      [%del-react id=@da p=ship]
  ==
::
++  apply-reacts
  |=  [old=v-reacts new=v-reacts]
  ^-  v-reacts
  %-  (~(uno by old) new)
  |=  [* a=(rev (unit react)) b=(rev (unit react))]
  +:(apply-rev a b)
::
++  reduce-reacts
  |=  reacts=v-reacts
  ^-  (map ship react)
  %-  ~(gas by *(map ship react))
  %+  murn  ~(tap by reacts)
  |=  [=ship (rev react=(unit react))]
  ?~  react  ~
  (some ship u.react)
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

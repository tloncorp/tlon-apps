/-  c=chat, g=groups, ch=channel
|%
+$  flag  (pair ship term)
+$  feel  @ta
+$  view  ?(%grid %list)
+$  stash  (map flag:g heap)
+$  heap
  $:  =net
      =log
      =perm:ch
      =view
      =curios
      =remark
  ==
++  curios
  =<  curios
  |%
  +$  curios
    ((mop time curio) lte)
  ++  on
    ((^on time curio) lte)
  +$  diff
    (pair time delta)
  +$  delta
    $%  [%add p=heart]
        [%del ~]
        [%add-feel p=ship q=feel]
        [%del-feel p=ship]
    ==
  --
+$  curio  [seal heart]
+$  seal
  $:  =time
      feels=(map ship feel)
      replied=(set time)
  ==
+$  heart
  $:  title=(unit @t)
      content=(list inline)
      author=ship
      sent=time
      replying=(unit time)
  ==
+$  inline
  $@  @t
  $%  [%italics p=inline]
      [%bold p=inline]
      [%strike p=inline]
      [%inline-code p=cord]
      [%blockquote p=(list inline)]
      [%code p=cord]
      [%tag p=cord]
      [%link p=cord q=cord]
      [%break ~]
  ==
::
+$  log
  ((mop time diff) lte)
++  log-on
  ((on time diff) lte)
+$  action
  (pair flag:g update)
+$  update
  (pair time diff)
+$  diff
  $%  [%curios p=diff:curios]
    ::
      [%add-sects p=(set sect:g)]
      [%del-sects p=(set sect:g)]
    ::
      [%create p=perm:ch]
  ==
+$  net
  $~  [%load ~]
  $%  [%sub p=ship]
      [%pub ~] :: TODO: permissions?
      [%load ~]
  ==
++  briefs
  =<  briefs
  |% 
  +$  briefs
    (map flag brief)
  +$  brief
    [last=time count=@ud read-id=(unit time)]
  +$  update
    (pair flag brief)
  --
::
+$  remark
  [last-read=time watching=_| ~]
::
+$  remark-action
  (pair flag remark-diff)
::
+$  remark-diff
  $%  [%read ~]
      [%read-at p=time]
      [?(%watch %unwatch) ~]
  ==
::
--
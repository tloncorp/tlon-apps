::  call as *%%%/groups/0/lib/rail/hoon +groups!rail
::
::TODO  investigate adding a "meta-build" for rune that evaluates the file
::      to obtain a hoon ast, which it then compiles into the result
::
:-  %say
|=  $:  [now=@da eny=@uvJ bec=beak]
        ~
        bcls=$~(& ?)
    ==
:-  %hoon
^-  @t
::
=/  snor  ::  ordered insert
  |*  [a=* b=(list) c=$-([* *] ?)]
  ?~  b  [a]~
  ?:  (c a i.b)  [a b]
  [i.b $(b t.b)]
::
=/  [maz=(list mark) max=@ud]
  %+  roll
    .^((list path) %ct (en-beam bec(r da+now) /mar))
  |=  [pax=path [maz=(list mark) max=@ud]]
  ?.  =(%hoon (rear pax))  [maz max]
  =/  mar=mark  (rap 3 (join '-' (snip (slag 1 pax))))
  ?:  |(=('rail' mar) =('de-rail' mar) =('cage' mar) =('unsafe' mar))
    ::TODO  be more clever?
    %-  (slog (cat 3 'rail dropping "reserved" name: %' mar) ~)
    [maz max]
  [(snor mar maz aor) (^max (met 3 mar) max)]
::
%+  rap  3
:~  '''
    ::  THIS FILE IS AUTO-GENERATED, DO NOT MODIFY IT DIRECTLY
    ::
    ::  to update it, pulling in *all* marks in your current %groups desk, run:
    ::  *%%%/groups/0/lib/rail/hoon +groups!rail
    ::
    ::  BE VERY CAREFUL, if there are mark files in your desk that are not in
    ::  the "stock" distribution, the generated file will fail to built on
    ::  other ships. CI *should* catch this, but remain mindful.
    ::
    ::  specifies a $rail type, a "typed $cage" containing all the desk's marks
    ::  and a +de-rail helper for turning that back into a $cage.
    ::
    '''
  ::
    %^  rap  3  '\0a'
    %+  join    '\0a'
    %+  turn  maz
    |=  m=mark
    =+  gap=(fil 3 (add 2 (sub max (met 3 m))) ' ')
    (rap 3 '/%  ' m gap '%' m ~)
    '\0a'
  ::
    '''
    ::
    ^?
    |%
    +$  rail  $+  rail
      $%  [%unsafe =cage]
        ::
    '''
  ::
    %^  rap  3  '\0a      '
    %+  join    '\0a      '
    %+  turn  maz
    |=  m=mark
    =+  gap=(fil 3 (add 2 (sub max (met 3 m))) ' ')
    %+  rap  3
    :~  '$:  %'  m  gap
        ?.(bcls '' (rap 3 '$+  ' m gap ~))
        '_*vale:'  m  gap  '=='
    ==
    '\0a'
  ::
    '''
      ==
    ::
    ++  de-rail
      |=  =rail
      ^-  cage
      ?-  -.rail
        %unsafe  cage.rail
      ::
    '''
  ::
    %^  rap  3  '\0a    '
    %+  join    '\0a    '
    %+  turn  maz
    |=  m=mark
    =+  gap=(fil 3 (add 2 (sub max (met 3 m))) ' ')
    (rap 3 '%' m gap '[-.rail !>(+.rail)]' ~)
    '\0a'
  ::
    '''
      ==
    --
    '''  ::TODO  discipline arg?
    '\0a'
==
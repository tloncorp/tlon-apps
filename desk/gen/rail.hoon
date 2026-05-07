::  call as *%%%/groups/0/lib/rail/hoon +groups!rail
::
::TODO  investigate adding a "meta-build" for rune that evaluates the file
::      to obtain a hoon ast, which it then compiles into the result
::
=/  non-strict-marks=(set mark)
  ^~  %-  sy  ^-  (list mark)
  :~  %chat-changed-writs-1
      %chat-club-action
      %chat-club-action-2
      %chat-dm-action-2
      %chat-dm-diff-2
      %chat-heads-4
      %chat-paged-writs-4
      %chat-scam-4
      %chat-scan-4
      %chat-writ-4
      %writ-response-4
    ::
      ::TODO  make strict one day
      %channel-changed-posts
      %channel-changed-posts-1
      %channel-post
      %channel-post-5
      %channel-posts
      %channel-posts-4
      %channel-posts-5
      %channel-replies-5
      %channel-said-3
      %channel-scan-4
      %channel-scam-4
      %channels-2
      %channels-5
    ::
      %channel-checkpoint
      %channel-denied
      %channel-logs
      %channel-said-1
      %channel-said-2
      %channel-update
      %hook-channel-preview
      %hook-full
      %hook-response-0
      %hook-template
    ::
      %group-update
      %group-log
  ==
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
        'p=_*vale:'  m  gap  '=='
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
    ::
    ++  en-rail
      |=  cage
      ^-  rail
      ?+  p  [%unsafe p q]
    '''
  ::
    %^  rap  3  '\0a    '
    %+  join    '\0a    '
    %+  turn  maz
    |=  m=mark
    =+  gap=(fil 3 (add 2 (sub max (met 3 m))) ' ')
    (rap 3 '%' m gap '[p !<(_*vale:' m ' q)]' ~)
    '\0a'
  ::
    '''
      ==
    ::
    ++  discipline
      ^-  (list [=mark strict=? =type])
      :~
    '''
  ::
    %^  rap  3  '  '
    %+  join    '\0a      '
    %+  turn  maz
    |=  m=mark
    =+  gap=(fil 3 (add 2 (sub max (met 3 m))) ' ')
    =+  sic=?:((~(has in non-strict-marks) m) '|' '&')
    (rap 3 ':+  %' m gap sic '  -:!>(*vale:' m ')' ~)
    '\0a'
  ::
    '''
      ==
    --
    '''  ::TODO  discipline arg?
    '\0a'
==
::  %steward-prompts-action-1: a prompts module action (set / seed / sync)
::
/-  p=steward-prompts
|_  act=action:v1:p
++  grad  %noun
++  grow
  |%
  ++  noun  act
  ++  json
    =,  enjs:format
    ?-  -.act
        %set
      %-  frond  :-  'set'
      %-  pairs
      :~  ['bot' s+(scot %p bot.act)]
          ['name' s+name.act]
          ['text' s+text.act]
      ==
    ::
        %seed
      %-  frond  :-  'seed'
      %-  pairs
      %+  turn  ~(tap by prompts.act)
      |=  [n=name:v1:p t=@t]
      [n s+t]
    ::
        %sync
      %-  frond  :-  'sync'
      %-  pairs
      %+  turn  ~(tap by prompts.act)
      |=  [n=name:v1:p =prompt:v1:p]
      :-  n
      %-  pairs
      :~  ['text' s+text.prompt]
          ['updated' s+(scot %da updated.prompt)]
          ['edited' b+edited.prompt]
      ==
    ::
        %request
      (frond 'request' ~)
    ==
  --
++  grab
  |%
  ++  noun  action:v1:p
  ++  json
    =,  dejs:format
    %-  of
    :~  [%set (ot ~[bot+(se %p) name+so text+so])]
        [%seed (om so)]
        [%sync (om (ot ~[text+so updated+(se %da) edited+bo]))]
        [%request ul]
    ==
  --
--

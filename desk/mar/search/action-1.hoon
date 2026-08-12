::  search-action-1: mark for %search inbound actions
::
::    also the mark producing agents accept, so %search can ask them to
::    resubmit their content with a %rebuild.
::
/-  se=search
/+  sj=search-json
|_  =action:v1:se
++  grad  %noun
++  grow
  |%
  ++  noun  action
  ++  json
    =,  enjs:format
    ^-  ^json
    ?-  -.action
        %touch
      %+  frond  'touch'
      %-  pairs
      :~  :-  'entries'
          :-  %a
          %+  turn  entries.action
          |=  e=entry:v1:se
          ^-  ^json
          %-  pairs
          :~  ['target' (target:enjs:sj target.e)]
              ['title' s+title.e]
              ['context' s+context.e]
              ['text' s+text.e]
              ['author' ?~(author.e ~ s+(scot %p u.author.e))]
              ['time' s+(scot %da time.e)]
          ==
      ==
    ::
        %erase
      %+  frond  'erase'
      %-  pairs
      :~  ['targets' a+(turn targets.action target:enjs:sj)]
      ==
    ::
        %rebuild
      %+  frond  'rebuild'
      %-  pairs
      :~  ['sources' a+(turn ~(tap in sources.action) source:enjs:sj)]
      ==
    ::
        %wipe
      (frond 'wipe' (pairs ~[['source' (source:enjs:sj source.action)]]))
    ::
        %reset
      (frond 'reset' ~)
    ==
  --
++  grab
  |%
  ++  noun  action:v1:se
  ++  json  action:dejs:sj
  --
--

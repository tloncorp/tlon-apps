::  %steward-prompts-update-1: a prompts module update, served to clients
::  as json
::
/-  p=steward-prompts
|_  upd=update:v1:p
++  grad  %noun
++  grow
  |%
  ++  noun  upd
  ++  json
    =,  enjs:format
    ?-  -.upd
        %prompts
      %-  frond  :-  'prompts'
      %-  pairs
      :~  ['bot' s+(scot %p bot.upd)]
          ['prompts' (prompts-json prompts.upd)]
      ==
    ::
        %set
      %-  frond  :-  'set'
      %-  pairs
      :~  ['name' s+name.upd]
          ['prompt' (prompt-json prompt.upd)]
      ==
    ==
  ++  prompts-json
    |=  =prompts:v1:p
    =,  enjs:format
    %-  pairs
    %+  turn  ~(tap by prompts)
    |=  [n=name:v1:p =prompt:v1:p]
    [n (prompt-json prompt)]
  ++  prompt-json
    |=  =prompt:v1:p
    =,  enjs:format
    %-  pairs
    :~  ['text' s+text.prompt]
        ['updated' s+(scot %da updated.prompt)]
        ['edited' b+edited.prompt]
    ==
  --
++  grab
  |%
  ++  noun  update:v1:p
  --
--

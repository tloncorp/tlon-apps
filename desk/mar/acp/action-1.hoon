::  %acp-action-1: manage a generic, bidirectional ACP connection
::
/-  a=acp
=>  |%
    +$  jsn  json
    --
|_  act=action:v1:a
++  grad  %noun
++  grow
  |%
  ++  noun  act
  ++  json
    =,  enjs:format
    =/  as-string  |=(value=@t `jsn`[%s value])
    =/  as-number  |=(value=@ud `jsn`(numb value))
    ^-  jsn
    ?-  -.act
        %open
      (frond 'open' (frond 'connection' s+connection.act))
    ::
        %send
      %-  frond  :-  'send'
      %-  pairs
      :~  connection+(as-string connection.act)
          target+(as-string target.act)
          payload+(as-string payload.act)
      ==
    ::
        %ack
      %-  frond  :-  'ack'
      %-  pairs
      :~  connection+(as-string connection.act)
          target+(as-string target.act)
          through+(as-number through.act)
      ==
    ::
        %close
      %-  frond  :-  'close'
      %-  pairs
      :~  connection+(as-string connection.act)
          reason+(as-string reason.act)
      ==
    ::
        %drop
      (frond 'drop' (frond 'connection' s+connection.act))
    ==
  --
++  grab
  |%
  ++  noun  action:v1:a
  ++  json
    =,  dejs:format
    |=  jon=jsn
    ^-  action:v1:a
    %.  jon
    %-  of
    :~  [%open (ot connection+so ~)]
        [%send (ot connection+so target+(su (perk %client %agent ~)) payload+so ~)]
        [%ack (ot connection+so target+(su (perk %client %agent ~)) through+ni ~)]
        [%close (ot connection+so reason+so ~)]
        [%drop (ot connection+so ~)]
    ==
  --
--

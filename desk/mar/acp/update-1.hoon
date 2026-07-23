::  %acp-update-1: connection lifecycle and ordered JSON-RPC envelopes
::
/-  a=acp
=>  |%
    +$  jsn  json
    --
|_  upd=update:v1:a
++  grad  %noun
++  grow
  |%
  ++  noun  upd
  ++  json
    =,  enjs:format
    =/  as-string  |=(value=@t `jsn`[%s value])
    =/  as-bool  |=(value=? `jsn`[%b value])
    =/  as-maybe-string
      |=  value=(unit @t)
      ^-  jsn
      ?~(value ~ [%s u.value])
    ^-  jsn
    ?-  -.upd
        %connection
      %-  frond  :-  'connection'
      %-  pairs
      :~  id+(as-string connection.upd)
          open+(as-bool open.upd)
          reason+(as-maybe-string reason.upd)
      ==
    ::
        %messages
      %-  frond  :-  'messages'
      a+(turn messages.upd message-json)
    ==
  ++  message-json
    |=  msg=message:v1:a
    ^-  jsn
    =,  enjs:format
    =/  as-string  |=(value=@t `jsn`[%s value])
    =/  as-number  |=(value=@ud `jsn`(numb value))
    %-  pairs
    :~  sequence+(as-number sequence.msg)
        sent+(as-string (scot %da sent.msg))
        payload+(as-string payload.msg)
    ==
  --
++  grab
  |%
  ++  noun  update:v1:a
  --
--

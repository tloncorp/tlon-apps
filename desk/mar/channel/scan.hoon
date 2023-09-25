/-  d=channel
/+  j=channel-json
|_  =scan:d
++  grad  %noun
++  grow
  |%
  ++  noun  scan
  ++  json
    =,  enjs:format
    :-  %a
    %+  turn
      scan
    |=  =scan-result:d
    ^-  ^json
    %+  frond  -.scan-result
    ?-    -.scan-result
        %note  (rr-note:enjs:j rr-note.scan-result)
        %quip
      %-  pairs
      :~  id-note+(id:enjs:j id-note.scan-result)
          quip+(rr-quip:enjs:j rr-quip.scan-result)
      ==
    ==
  --
++  grab
  |%
  +$  noun  scan:d
  --
--

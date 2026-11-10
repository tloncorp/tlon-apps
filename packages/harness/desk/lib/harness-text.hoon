::  Text boundaries accept arbitrary bytes without emitting invalid UTF-8.
|%
++  clean
  |=  text=@t
  ^-  @t
  =/  bytes=(list @)  (rip 3 text)
  =|  reversed-bytes=(list @)
  |-
  ?~  bytes  (rap 3 (flop reversed-bytes))
  =/  lead  i.bytes
  ?:  (lth lead 128)  $(bytes t.bytes, reversed-bytes [lead reversed-bytes])
  =/  width=@ud
    ?:  &((gte lead 194) (lte lead 223))  2
    ?:  &((gte lead 224) (lte lead 239))  3
    ?:  &((gte lead 240) (lte lead 244))  4
    0
  =/  part=(list @)  (scag width `(list @)`bytes)
  ::  Check continuation bytes and reject overlong encodings, surrogates,
  ::  and values beyond Unicode's maximum code point.
  =/  valid=?
    ?&  !=(0 width)
        ?=([@ @ *] part)
        =((lent part) width)
        (levy `(list @)`t.part |=(b=@ &((gte b 128) (lte b 191))))
        |(!=(lead 224) (gte i.t.part 160))
        |(!=(lead 237) (lth i.t.part 160))
        |(!=(lead 240) (gte i.t.part 144))
        |(!=(lead 244) (lth i.t.part 144))
    ==
  ?:  valid
    %=  $
      bytes  (slag width `(list @)`bytes)
      reversed-bytes  (weld (flop part) reversed-bytes)
    ==
  ::  U+FFFD marks invalid bytes; valid surrounding text is retained.
  $(bytes t.bytes, reversed-bytes [189 191 239 reversed-bytes])
++  clip
  |=  [text=@t cap=@ud]
  ^-  @t
  ?:  (lte (met 3 text) cap)  (clean text)
  =/  boundary  cap
  |-
  ?:  =(boundary 0)  ' ...(truncated)'
  =/  next  (cut 3 [boundary 1] text)
  ?:  &((gte next 128) (lth next 192))  $(boundary (dec boundary))
  (cat 3 (clean (end [3 boundary] text)) ' ...(truncated)')
--

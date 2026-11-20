::  One-shot civil time with an explicit UTC offset. No guessed timezone or
::  recurring local-time rule; ambiguous/missing offsets are rejected.
|%
::
++  parse
  |=  [text=@t now=@da]
  ^-  [at=@da timezone=@t]
  =/  size  (met 3 text)
  ?>  &((gte size 20) (lte size 35))
  =/  part  |=([at=@ud len=@ud] (cut 3 [at len] text))
  =/  zone-size  ?:(=('Z' (part (dec size) 1)) 1 6)
  =/  zone-at  (sub size zone-size)
  ?>  (gte zone-at 19)
  =/  fraction=@dr
    ?:  =(zone-at 19)  ~s0
    ?>  &(=('.' (part 19 1)) (gth zone-at 20))
    =/  digits  (sub zone-at 20)
    ?>  (lte digits 9)
    =/  number  (need (rush (part 20 digits) dem))
    (div (mul number ~s1) (pow 10 digits))
  ?>  ?&  =('-' (part 4 1))
          =('-' (part 7 1))
          =('T' (part 10 1))
          =(':' (part 13 1))
          =(':' (part 16 1))
      ==
  =/  number
    |=  [at=@ud len=@ud]
    (need (rush (part at len) dem))
  =/  year-number  (number 0 4)
  =/  month  (number 5 2)
  =/  day  (number 8 2)
  =/  hour  (number 11 2)
  =/  minute  (number 14 2)
  =/  second  (number 17 2)
  ?>  ?&  (gte year-number 2.000)
          (lte year-number 9.999)
          (gte month 1)
          (lte month 12)
          (gte day 1)
          (lte day 31)
          (lth hour 24)
          (lth minute 60)
          (lth second 60)
      ==
  =/  date
    %*  .  (yore ~2000.1.1)
      y  year-number
      m  month
      d.t  day
      h.t  hour
      m.t  minute
      s.t  second
    ==
  ::  Conversion must preserve the civil fields; normalization would accept
  ::  impossible dates such as September 31.
  =/  at  (year date)
  ?>  =(date (yore at))
  =/  zone  (part zone-at zone-size)
  =/  offset=@dr
    ?:  =('Z' zone)  ~s0
    ?>  =(6 zone-size)
    ?>  ?&  |(=('+' (part zone-at 1)) =('-' (part zone-at 1)))
            =(':' (part (add zone-at 3) 1))
            !=('-00:00' zone)
        ==
    =/  hours  (number (add zone-at 1) 2)
    =/  minutes  (number (add zone-at 4) 2)
    ?>  &((lte hours 14) (lth minutes 60))
    ?>  |((lth hours 14) =(minutes 0))
    (add (mul hours ~h1) (mul minutes ~m1))
  ::  Civil time east of UTC is ahead of the instant it names. Subtract a
  ::  positive offset; add a negative one, then include fractional seconds.
  =.  at
    %+  add  fraction
    ?:  =('-' (part zone-at 1))  (add at offset)
    (sub at offset)
  ?>  &((gth at now) (lte at (add now ~d3653)))
  [at ?:(=('Z' zone) 'UTC' (cat 3 'UTC' zone))]
--

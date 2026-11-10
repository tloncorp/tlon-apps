::  Bounded exact integer arithmetic. No evaluation, I/O or ambient authority.
|%
++  limit  9.007.199.254.740.991
++  integer
  |=  value=json
  ^-  @ud
  ?>  ?=(%n -.value)
  ?>  (lte (met 3 p.value) 16)
  =/  number  (need (rush p.value dem))
  ?>  (lte number limit)
  number
++  evaluate
  |=  args=@t
  ^-  @t
  =/  parsed
    %-  mole
    |.
    ?>  (lte (met 3 args) 8.192)
    =/  fields=[operation=@t values=(list json)]
      %-  %-  ot:dejs:format
          ~[operation+so:dejs:format values+(ar:dejs:format |=(j=json j))]
      (need (de:json:html args))
    ?>  &((gth (lent values.fields) 0) (lte (lent values.fields) 64))
    =/  values  (turn values.fields integer)
    =/  result=[negative=? magnitude=@ud]
      ?:  |(=('sum' operation.fields) =('product' operation.fields))
        :-  |
        =/  total  ?:(=('sum' operation.fields) 0 1)
        |-  ^-  @ud
            ?~  values  total
            =.  total
              ?:(=('sum' operation.fields) (add total i.values) (mul total i.values))
            ?>  (lte total limit)
            $(values t.values)
      ?>  =(2 (lent values))
      ?>  ?=(^ values)
      ?>  ?=(^ t.values)
      =/  a  i.values
      =/  b  i.t.values
      ?:  =('difference' operation.fields)
        ?:  (gte a b)  [| (sub a b)]
        [& (sub b a)]
      ?>  =('ceiling_quotient' operation.fields)
      ?>  (gth b 0)
      [| (add (div a b) ?:(=(0 (mod a b)) 0 1))]
    (cat 3 ?:(negative.result '-' '') (crip (a-co:co magnitude.result)))
  ?~  parsed
    'error: calculate needs operation sum, product, difference or ceiling_quotient and 1..64 nonnegative safe integers in values. Difference and ceiling_quotient require two values; divisor must be positive. Inputs and results must not exceed 9007199254740991.'
  (cat 3 '{"result":' (cat 3 u.parsed '}'))
--

/+  *test, calculator=harness-calculate, ht=harness-tools
|%
++  test-exact-pack-counts-and-money
  %-  zing
  %+  turn
    :~  ['{"operation":"difference","values":[72,17]}' '{"result":55}']
        ['{"operation":"ceiling_quotient","values":[55,5]}' '{"result":11}']
        ['{"operation":"ceiling_quotient","values":[116,10]}' '{"result":12}']
        ['{"operation":"ceiling_quotient","values":[53,25]}' '{"result":3}']
        ['{"operation":"product","values":[11,1250]}' '{"result":13750}']
        ['{"operation":"sum","values":[13750,4080,2400,900]}' '{"result":21130}']
        ['{"operation":"sum","values":[14300,4500,2550,900]}' '{"result":22250}']
        ['{"operation":"difference","values":[22000,22250]}' '{"result":-250}']
        ['{"operation":"product","values":[0,9007199254740991]}' '{"result":0}']
        ['{"operation":"ceiling_quotient","values":[0,5]}' '{"result":0}']
    ==
  |=  [args=@t expected=@t]
  (expect-eq !>(expected) !>((evaluate:calculator args)))
++  test-malformed-and-unbounded-arithmetic-has-no-effect
  %-  zing
  %+  turn
    :~  'not-json'
        '{"operation":"sum","values":[]}'
        '{"operation":"sum","values":[-1]}'
        '{"operation":"sum","values":[1.5]}'
        '{"operation":"sum","values":["1"]}'
        '{"operation":"sum","values":[9007199254740992]}'
        '{"operation":"sum","values":[9007199254740991,1]}'
        '{"operation":"product","values":[9007199254740991,2]}'
        '{"operation":"difference","values":[1]}'
        '{"operation":"ceiling_quotient","values":[1,0]}'
        '{"operation":"eval","values":[1]}'
    ==
  |=  args=@t
  (expect !>((find-sub:ht 'error: calculate' (evaluate:calculator args))))
++  test-arithmetic-needs-no-code-grant
  (expect !>((tool-granted:ht 'calculate' ~)))
++  test-operand-count-and-input-size-are-bounded
  =/  args
    %-  en:json:html
    (pairs:enjs:format ~[['operation' %s 'sum'] ['values' %a (reap 65 `json`[%n '1'])]])
  =/  oversized  (crip (reap 8.193 '0'))
  ;:  weld
      (expect !>((find-sub:ht 'error: calculate' (evaluate:calculator args))))
      (expect !>((find-sub:ht 'error: calculate' (evaluate:calculator oversized))))
  ==
--

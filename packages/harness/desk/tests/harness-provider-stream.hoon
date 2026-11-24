/-  h=harness
/+  *test, provider=harness-provider
|%
::  Usage has its own events and can arrive after the final text choice.
::  A missing or malformed counter does not erase the counter already read.
::
++  test-usage-survives-partial-events-after-finish
  =/  body
    %+  rap  3
    :~  'data: {"usage":{"prompt_tokens":12},"choices":[]}\0a'
        'data: {"choices":[{"delta":{"content":"Hello"},"finish_reason":"stop"}]}\0a'
        'data: {"usage":{"completion_tokens":3}}\0a'
        'data: {"usage":{"prompt_tokens":null,"completion_tokens":"bad"}}\0a'
    ==
  =/  result  (parse-chat-sse:provider body)
  ?>  ?=(%& -.result)
  ;:  weld
      (expect-eq !>(`usage:h`[12 3]) !>(u.p.result))
      (expect-eq !>(`item:h`[%assistant 'Hello' ~]) !>(it.p.result))
      (expect-eq !>(`stop-reason:h`%stop) !>(stop.p.result))
  ==
::
++  test-interleaved-call-fragments-keep-their-identities
  =/  body
    %+  rap  3
    :~  'data: {"choices":[{"delta":{"tool_calls":['
        '{"index":0,"id":"clock","function":{"name":"current_","arguments":"{"}},'
        '{"index":1,"id":"sum","function":{"name":"calculate","arguments":"{"}}'
        ']}}]}\0a'
        'data: {"choices":[{"delta":{"tool_calls":['
        '{"index":1,"function":{"arguments":"}"}},'
        '{"index":0,"function":{"name":"time","arguments":"}"}}'
        ']},"finish_reason":"tool_calls"}]}\0a'
    ==
  =/  result  (parse-chat-sse:provider body)
  ?>  ?=(%& -.result)
  ?>  ?=(%assistant -.it.p.result)
  =/  by-id=(map @t [name=@t args=@t])
    %-  ~(gas by *(map @t [name=@t args=@t]))
    %+  turn  calls.it.p.result
    |=  call=tool-call:h
    [id.call [name.call args.call]]
  ;:  weld
      (expect-eq !>(2) !>((lent calls.it.p.result)))
      (expect-eq !>(['current_time' '{}']) !>((~(got by by-id) 'clock')))
      (expect-eq !>(['calculate' '{}']) !>((~(got by by-id) 'sum')))
      (expect-eq !>(`stop-reason:h`%tool-calls) !>(stop.p.result))
  ==
::  A finished output item is not a finished Responses request.
::
++  test-responses-item-needs-a-terminal-event
  =/  body
    %+  rap  3
    :~  'data: {"type":"response.output_item.done","item":'
        '{"type":"message","content":[{"type":"output_text","text":"Hello"}]}}\0a'
    ==
  =/  result  (parse-responses-sse:provider body)
  =/  expected=(each [stop=stop-reason:h u=usage:h it=item:h] @t)
    [%| 'provider stream ended before completion']
  (expect-eq !>(expected) !>(result))
--

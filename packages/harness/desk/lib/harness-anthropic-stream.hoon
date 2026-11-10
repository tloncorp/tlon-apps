::  Assemble native Messages stream blocks and tool-argument fragments.
/+  w=harness-provider-wire, failure=harness-failure
|%
+$  stream
  $:  message=json
      blocks=(map @ud json)
      arguments=(map @ud @t)
      opened=(set @ud)
      error=(unit @t)
  ==
::
++  collect-event
  |=  [event=json collected=stream]
  ^-  stream
  =/  error  (wire-error:failure event)
  ?^  error  collected(error error)
  =/  type  (str:w event 'type')
  ?:  =('message_start' type)
    collected(message (need (get:w event 'message')))
  ?:  =('message_delta' type)
    =/  message  (merge:w message.collected (need (get:w event 'delta')))
    =/  usage  (get:w event 'usage')
    =?  message  ?=(^ usage)
      %^  put:w  message  'usage'
      (merge:w (fall (get:w message 'usage') [%o ~]) u.usage)
    collected(message message)
  =/  index  (num:w event 'index')
  ?:  =('content_block_start' type)
    %=  collected
      blocks  (~(put by blocks.collected) index (need (get:w event 'content_block')))
      opened  (~(put in opened.collected) index)
    ==
  ?.  |(=('content_block_delta' type) =('content_block_stop' type))
    collected
  ?>  (~(has in opened.collected) index)
  ?:  =('content_block_stop' type)
    (close-block index collected)
  (collect-delta index (need (get:w event 'delta')) collected)
::  Tool arguments are JSON fragments until their block closes. Parse the
::  assembled object once and retain the block's native position.
::
++  close-block
  |=  [index=@ud collected=stream]
  ^-  stream
  =/  block  (~(got by blocks.collected) index)
  =/  input  (~(get by arguments.collected) index)
  =?  block  ?=(^ input)
    =/  parsed  (need (de:json:html u.input))
    ?>  ?=(%o -.parsed)
    (put:w block 'input' parsed)
  %=  collected
    blocks  (~(put by blocks.collected) index block)
    opened  (~(del in opened.collected) index)
  ==
::
++  collect-delta
  |=  [index=@ud delta=json collected=stream]
  ^-  stream
  =/  type  (str:w delta 'type')
  ?:  =('input_json_delta' type)
    =/  prior  (fall (~(get by arguments.collected) index) '')
    =/  joined  (cat 3 prior (str:w delta 'partial_json'))
    collected(arguments (~(put by arguments.collected) index joined))
  =/  field=@t
    ?+  type  ''
      %'text_delta'  'text'
      %'thinking_delta'  'thinking'
      %'signature_delta'  'signature'
    ==
  ?:  =('' field)  collected
  =/  block  (~(got by blocks.collected) index)
  =/  joined  (append:w block field (str:w delta field))
  collected(blocks (~(put by blocks.collected) index joined))
--

/+  *test, failure=harness-failure, hl=harness
|%
++  test-http-errors-have-safe-categories
  %-  expect
  !>  ?&  =('authentication' kind:(describe:failure 'http error 401: secret'))
          =('credits' kind:(describe:failure 'http error 402: secret'))
          =('rate-limit' kind:(describe:failure 'http error 429: secret'))
          =('permission' kind:(describe:failure 'http error 403: secret'))
      ==
++  test-private-provider-error-is-not-published
  =/  body  (public-message:failure 'http error 401: credential=TOP_SECRET private prompt')
  %-  expect
  !>  ?&  !(contains:failure body 'top_secret')  !(contains:failure body 'private prompt')
          (contains:failure body 'authenticate')
      ==
++  test-structured-provider-error-retains-private-diagnostic
  =/  jon  (need (de:json:html '{"error":{"type":"authentication_error","message":"fixture"}}'))
  =/  raw  (need (wire-error:failure jon))
  (expect-eq !>('authentication') !>(kind:(describe:failure raw)))
::  Size rejections in the shapes each provider route sends. Bodies arrive
::  as an HTTP error, or as a provider error inside a successful response.
::
++  anthropic
  ^-  (list @t)
  :~  'http error 413: {"type":"error","error":{"type":"invalid_request_error","message":"Payload too large"}}'
      'http error 400: {"type":"error","error":{"type":"request_too_large","message":"Request exceeds the maximum size"}}'
      'http error 400: {"type":"error","error":{"type":"invalid_request_error","message":"prompt is too long: 210000 tokens > 200000 maximum"}}'
      'http error 400: {"type":"error","error":{"type":"invalid_request_error","message":"input length and `max_tokens` exceed context limit: 198000 + 8192 > 200000"}}'
      'http error 400: {"type":"error","error":{"type":"invalid_request_error","message":"Request size exceeds model context window"}}'
  ==
++  openai
  ^-  (list @t)
  :~  'http error 400: {"error":{"message":"Your input is too long.","type":"invalid_request_error","code":"context_length_exceeded"}}'
      'http error 400: {"error":{"message":"Context length exceeded for this model."}}'
      'http error 400: {"error":{"message":"This model\'s maximum context length is 128000 tokens.","code":null}}'
      'http error 400: {"error":{"message":"Your input exceeds the context window of this model.","code":null}}'
      'provider error: {"code":"context_length_exceeded","message":"Your input exceeds the context window of this model."}'
  ==
++  openrouter
  ^-  (list @t)
  :~  'http error 400: {"error":{"message":"This endpoint\'s maximum context length is 131072 tokens.","code":400}}'
      'http error 400: {"error":{"message":"Input exceeds the maximum allowed input length.","code":400}}'
      'http error 400: {"error":{"message":"Input exceeds maximum allowed input length","code":400}}'
      'http error 400: {"error":{"message":"The input token count (1200000) exceeds the maximum number of tokens allowed (1048576).","code":400}}'
      'http error 400: {"error":{"message":"Exceeded model token limit: 262144","code":400}}'
      'http error 400: {"error":{"message":"Input validation error: inputs tokens + max_new_tokens is longer than the model\'s context length.","code":400}}'
      'http error 400: {"error":{"message":"Upstream error","code":"context_window_exceeded"}}'
  ==
++  all-sizes
  :(weld anthropic openai openrouter ~[chatgpt xai])
++  chatgpt
  'provider error: {"type":"error","error":{"message":"Your input ran out of room in the model\'s context window."}}'
++  xai
  'http error 400: {"code":"Client specified an invalid argument","error":"This model\'s maximum prompt length is 131072 but the request contains 140000 tokens."}'
++  test-anthropic-size-rejections
  (expect !>((levy anthropic oversized:failure)))
::  A Responses response.failed reaches the failure text as a provider error.
::
++  test-openai-size-rejections
  =/  failed
    %-  need
    %-  de:json:html
    '{"type":"response.failed","response":{"status":"failed","error":{"code":"context_length_exceeded","message":"Your input exceeds the context window of this model."}}}'
  =/  raw  (need (wire-error:failure failed))
  %-  expect
  !>  ?&  (levy openai oversized:failure)
          =('provider error: ' (end 3^16 raw))
          (oversized:failure raw)
      ==
++  test-chatgpt-ran-out-of-room
  %-  expect
  !>  ?&  (oversized:failure chatgpt)
          (oversized:failure 'provider error: {"message":"The context window ran out of space."}')
          !(oversized:failure 'provider error: {"message":"The disk ran out of space."}')
      ==
++  test-xai-prompt-length
  (expect !>((oversized:failure xai)))
++  test-openrouter-upstream-size-rejections
  (expect !>((levy openrouter oversized:failure)))
::  Groq sends its tokens-per-minute rate limit as a 413.
::
++  test-tpm-413-is-not-a-size-rejection
  %-  expect
  !>  ?&  !(oversized:failure 'http error 413: {"error":{"message":"Request too large for model `llama-3.3-70b-versatile` on tokens per minute (TPM): Limit 6000, Requested 9000.","type":"tokens","code":"rate_limit_exceeded"}}')
          !(oversized:failure 'http error 413: {"error":{"message":"Request too large: on TPM (tpm) limit 6000"}}')
      ==
++  test-window-too-small-is-a-request-error
  =/  raw  'http error 400: {"error":{"message":"The model context window too small for this request."}}'
  %-  expect
  !>  ?&  !(oversized:failure raw)
          =('request' kind:(describe:failure raw))
      ==
++  test-describe-uses-the-shared-predicate
  %-  expect
  !>  %+  levy  all-sizes
      |=(raw=@t =('context' kind:(describe:failure raw)))
::  A marked provider error still carries its size wording; the marker's
::  wording wins, because the message was left out.
::
++  test-marked-provider-error-gets-left-out-wording
  =/  raw  (overflow:hl 'http error 400: {"error":{"message":"This model\'s maximum context length is exceeded."}}')
  =/  info  (describe:failure raw)
  %-  expect
  !>  ?&  =('context' kind.info)
          (contains:failure message.info 'this message was left out')
          !=(message.info message:(describe:failure 'http error 413: too large'))
          =('context' kind:(describe:failure (overflow:hl 'context budget: no cut')))
          (contains:failure message:(describe:failure (overflow:hl 'context budget: no cut')) 'left out')
      ==
--

::  Public failure vocabulary. Never forward arbitrary provider bodies to a
::  hand: they may echo prompts, credentials, account IDs or private URLs.
::  Raw errors stay in the owner's event log; this projection is allowlisted.
/+  hl=harness
|%
++  contains
  |=  [text=@t part=@t]
  ^-  ?
  =/  hay  (cass (trip (end 3^8.192 text)))
  =/  needle  (trip part)
  =/  n  (lent needle)
  |-
  ?:  =(needle (scag n hay))  &
  ?~  hay  |
  $(hay t.hay)
++  http-status
  |=  raw=@t
  ^-  @ud
  ?.  =('http error ' (end 3^11 raw))  0
  (fall (rush (cut 3 [11 3] raw) dem) 0)
::  A provider refused the request as too large for the model. Groq sends
::  its tokens-per-minute rate limit as a 413, so that wording never counts.
::
++  oversized
  |=  raw=@t
  ^-  ?
  =/  has  |=(part=@t (contains raw part))
  ?:  |((has 'tokens per minute') (has '(tpm)'))  |
  ?|  =(413 (http-status raw))
      (has 'request_too_large')
      (has 'request exceeds the maximum size')
      (has 'prompt is too long')
      (has 'exceed context limit')
      (has 'exceeds model context window')
      (has 'context_length_exceeded')
      (has 'context length exceeded')
      (has 'maximum context length')
      (has 'exceeds the context window')
      &((has 'context window') |((has 'ran out of room') (has 'ran out of space')))
      (has 'maximum prompt length')
      (has 'maximum allowed input length')
      &((has 'input token count') (has 'exceeds the maximum'))
      (has 'exceeded model token limit')
      (has 'is longer than the model\'s context length')
      (has 'context_window_exceeded')
  ==
++  describe
  |=  raw=@t
  ^-  [kind=@t message=@t]
  =/  has  |=(part=@t (contains raw part))
  =/  status  (http-status raw)
  ::  A marked provider error still has its size wording, so this comes first.
  ?:  (overflowed:hl raw)
    :*  'context'
        'The request was too large for the model, so this message was left out. Send a new message to continue. If short messages are left out too, a model with a larger context window may be needed.'
    ==
  ?:  ?|  =(401 status)  (has 'authentication_error')  (has 'invalid_api_key')
          %-  has
          'invalid api key'
          (has 'token expired')
      ==
    :*  'authentication'
        'I could not authenticate with the model provider. The owner needs to update this provider\'s API key or sign in again in Harness settings, then send a new message.'
    ==
  ?:  (oversized raw)
    :*  'context'
        'The model provider rejected the request size or context length. Try a shorter message or a model with a larger context window.'
    ==
  ?:  ?|  =(402 status)  (has 'insufficient_quota')  (has 'insufficient credits')
          (has 'credit balance')  (has 'billing')  (has 'spend limit')
      ==
    :*  'credits'
        'The model provider reports insufficient credits or a billing/spending limit. The owner needs to check the provider account, add credits or adjust its limit, then send a new message.'
    ==
  ?:  |(=(429 status) (has 'rate_limit') (has 'rate limit'))
    :*  'rate-limit'
        'The model provider has reached a rate or usage limit. Wait before sending another message; if this continues, the owner should check the account\'s usage limits.'
    ==
  ?:  |(=(403 status) (has 'permission_error'))
    :*  'permission'
        'The model provider refused this request. The owner should check model access, account permissions and provider policy in Harness settings.'
    ==
  ?:  |(=(404 status) (has 'model_not_found') (has 'model not found'))
    :*  'model'
        'The selected model or inference endpoint was not found. The owner should check the conversation\'s provider and model in Harness settings.'
    ==
  ?:  (has 'context budget:')
    :*  'context'
        'The conversation cannot fit safely in this model\'s context budget. Try a larger-context model or a shorter request. The source transcript was retained.'
    ==
  ?:  (has 'compaction')
    :*  'compaction'
        'I could not produce a safe context checkpoint. The previous context and full transcript were retained. The owner can inspect the details; no retry was started automatically.'
    ==
  ?:  ?|  =(408 status)  =(504 status)  (has 'timed out')  (has 'timeout')
          (has 'request cancelled by runtime')
      ==
    :*  'timeout'
        'The request timed out or the connection was interrupted. Try sending another message. No retry has been started automatically.'
    ==
  ?:  |((gte status 500) (has 'overloaded_error'))
    :*  'unavailable'
        'The model provider is temporarily unavailable or overloaded. Try again later, or select another configured provider/model.'
    ==
  ?:  (has 'openai login renewal')
    :*  'unavailable'
        'OpenAI login renewal could not finish. Wait a minute and send another message. If this continues, the owner should check OpenAI settings.'
    ==
  ?:  =(400 status)
    :*  'request'
        'The model provider rejected the request format or options. The owner can inspect the session details and check model compatibility.'
    ==
  ?:  |((has 'response') (has 'provider stream'))
    :*  'response'
        'The model provider returned an empty, incomplete or unreadable response. Try another message; if it repeats, the owner should check provider compatibility.'
    ==
  :*  'unknown'
      'The Harness could not complete this request. The owner can inspect the session details for the cause.'
  ==
++  public-message
  |=  raw=@t
  message:(describe raw)
++  json
  |=  raw=@t
  ^-  ^json
  =/  info  (describe raw)
  (pairs:enjs:format ~[['kind' %s kind.info] ['message' %s message.info]])
++  wire-error
  |=  jon=^json
  ^-  (unit @t)
  ?.  ?=(%o -.jon)  ~
  =/  error  (~(get by p.jon) 'error')
  ?:  &(?=(^ error) !=(~ u.error))
    `(cat 3 'provider error: ' (en:json:html u.error))
  =/  response  (~(get by p.jon) 'response')
  ?.  ?=([~ %o *] response)  ~
  $(jon u.response)
--

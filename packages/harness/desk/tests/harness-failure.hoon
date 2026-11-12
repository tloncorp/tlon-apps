/+  *test, failure=harness-failure
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
--

/+  *test, defaults=harness-defaults, auth=harness-auth
|%
++  test-openai-device-login-is-the-bootstrap-route
  =/  config  builtin-config:defaults
  ;:  weld
      (expect-eq !>(device-url:auth) !>(url.config))
      (expect-eq !>('openai-device') !>((credential-for-config:auth config)))
  ==
--

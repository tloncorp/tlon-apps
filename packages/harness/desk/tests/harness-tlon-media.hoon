/-  t=harness-tlon
/+  *test, m=harness-tlon-media, p=harness-tlon-policy
|%
++  test-native-download-has-no-secret-or-body
  =/  url  'https://www.python.org/static/img/python-logo.png'
  =/  req  (download-request:m url)
  %+  expect-eq
    !>  ^-  request:http
        :*  %'GET'  url
            :~  ['Accept' 'image/png,image/jpeg,image/gif,image/webp']
                ['Accept-Encoding' 'identity']
            ==
            ~
        ==
  !>(req)
++  test-native-download-rejects-local-addresses-and-url-credentials
  =/  urls=(list @t)
    :~  'http://www.python.org/image.png'
        'https://127.0.0.1/image.png'
        'https://[::1]/image.png'
        'https://localhost/image.png'
        'https://service.local/image.png'
        'https://service.internal/image.png'
        'https://user:password@example.com/image.png'
        'https://example.com:8443/image.png'
        'https://example.com/image.png#fragment'
        'https://example.com/\0aimage.png'
    ==
  (expect !>((levy urls rejected-url)))
++  rejected-url
  |=  url=@t
  ^-  ?
  =(~ (mole |.((download-request:m url))))
++  test-image-rejects-svg-and-oversized-payloads
  %-  expect
  !>(&(=(~ (image-type:m [12 '<svg></svg>'])) =(~ (image-type:m [8.388.609 0xa1a.0a0d.474e.5089]))))
++  test-hosted-toggle-needs-no-static-credentials
  =/  config
    %-  need
    (de:json:html '{"storage-update":{"configuration":{"service":"presigned-url"}}}')
  (expect !>((hosted:m config)))
++  test-hosted-request-uses-fixed-broker-and-exact-file-metadata
  =/  req  (hosted-request:m ~nec 'identity-fixture' 'nec/a.png' 'image/png' 123)
  ?>  ?=(^ body.req)
  =/  payload  (need (de:json:html q.u.body.req))
  =/  want
    %-  need
    %-  de:json:html
    '{"token":"identity-fixture","contentLength":123,"contentType":"image/png","fileName":"nec/a.png"}'
  %-  expect
  !>  ?&  =('https://memex.tlon.network/v1/nec/upload' url.req)
          =(%'PUT' method.req)
          =(want payload)
          =(~[['Content-Type' 'application/json']] header-list.req)
      ==
++  response
  |=  [url=@t public=@t]
  ^-  client-response:iris
  =/  body  (en:json:html (pairs:enjs:format ~[['url' %s url] ['filePath' %s public]]))
  [%finished [200 ~] `['application/json' (as-octs:mimes:html body)]]
++  test-hosted-response-keeps-signed-url-exactly
  =/  url
    'https://storage.googleapis.com/bucket/nec/a.png?X-Goog-Credential=signer%40example.com%2Fscope&X-Goog-Signature=123'
  =/  public  'https://storage.googleapis.com/bucket/nec/a.png'
  (expect-eq !>([url public]) !>((hosted-response:m (response url public))))
++  test-hosted-response-rejects-private-or-mismatched-destinations
  =/  public  'https://storage.googleapis.com/bucket/nec/a.png'
  =/  rejected
    |=  url=@t
    =(~ (mole |.((hosted-response:m (response url public)))))
  %-  expect
  !>  ?&  (rejected 'http://127.0.0.1/a?sig=x')
          (rejected 'https://storage.googleapis.com.evil.example/a?sig=x')
          (rejected 'https://storage.googleapis.com/other?sig=x')
          (rejected 'https://storage.googleapis.com/bucket/nec/a.png')
      ==
++  test-hosted-response-rejects-oversized-body
  =/  res=client-response:iris  [%finished [200 ~] `['application/json' [16.385 0]]]
  (expect !>(=(~ (mole |.((hosted-response:m res))))))
--

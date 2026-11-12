/+  *test, s=harness-s3
|%
++  test-hmac-rfc4231
  %+  expect-eq
    !>('b0344c61d8db38535ca8afceaf0bf12b881dc200c9833da726e9376c2e32cff7')
  !>((s3-hex:s (s3-hmac-sha256:s [20 (fil 3 20 0xb)] [8 'Hi There'])))
++  test-hmac-binary-zero-result
  %+  expect-eq
    !>('86aea59e5530cc758b851d0ee8552c6ef50589b4e3b3abea8397c12dd893fd00')
  !>((s3-hex:s (s3-hmac-sha256:s [1 0x5c] [2 1])))
++  test-hmac-pad-ending-in-zero
  %+  expect-eq
    !>('41380f7c3a5f4f21dafbf5903204ae0870ca3f1bf0ed1f98ab22234e4369720f')
  !>((s3-hex:s (s3-hmac-sha256:s [64 (lsh 3^63 0x36)] [2 1])))
++  test-signed-put-independent-vector
  =/  got
    %:  presign:s
      :*  'http://localhost:9000'  'AKID'  'secret'  'bucket'  'us-east-1'
          'https://cdn.example.com/images/'
      ==
      ~2026.9.6
      'nec/a b.png'
      'image/png'
      &
    ==
  =/  want
    'http://localhost:9000/bucket/nec/a%20b.png?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=AKID%2F20260906%2Fus-east-1%2Fs3%2Faws4_request&X-Amz-Date=20260906T000000Z&X-Amz-Expires=300&X-Amz-SignedHeaders=cache-control%3Bcontent-type%3Bhost&x-amz-acl=public-read&X-Amz-Signature=d1e63ab2c3da30a904609cc4c745023fb469fd2680826375eb2cf32b5b3c0683'
  (expect !>(&(=(want url.got) =(public-url.got 'https://cdn.example.com/images/nec/a%20b.png'))))
++  test-uri-encoding-path-versus-query
  %+  expect-eq
    !>(['a%20b/%C3%A9%2B' 'a%20b%2F%C3%A9%2B'])
  !>([(s3-uri-encode:s 'a b/é+' &) (s3-uri-encode:s 'a b/é+' |)])
++  test-spaces-signs-and-sends-public-acl
  =/  got
    %:  presign:s
      ['https://ams3.digitaloceanspaces.com' 'AKID' 'secret' 'bucket' 'us-east-1' '']
      ~2026.9.6
      'lux/a.png'
      'image/png'
      &
    ==
  =/  want
    'https://ams3.digitaloceanspaces.com/bucket/lux/a.png?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=AKID%2F20260906%2Fus-east-1%2Fs3%2Faws4_request&X-Amz-Date=20260906T000000Z&X-Amz-Expires=300&X-Amz-SignedHeaders=cache-control%3Bcontent-type%3Bhost%3Bx-amz-acl&x-amz-acl=public-read&X-Amz-Signature=ed6b22464b8d4890ab2dcf4270c69fa79581750ad3c003a3108166b2813c0367'
  %-  expect
  !>  ?&  =(want url.got)
          .=  :~  ['Content-Type' 'image/png']  ['Cache-Control' 'public, max-age=3600']
                  ['x-amz-acl' 'public-read']
              ==
          headers.got
      ==
++  test-spaces-acl-free-retry-omits-both-acl-locations
  =/  got
    %:  presign:s
      ['https://ams3.digitaloceanspaces.com' 'AKID' 'secret' 'bucket' 'us-east-1' '']
      ~2026.9.6
      'lux/a.png'
      'image/png'
      |
    ==
  %-  expect
  !>  ?&  =(~ (find "acl" (trip url.got)))
          =(~[['Content-Type' 'image/png'] ['Cache-Control' 'public, max-age=3600']] headers.got)
      ==
++  test-spaces-endpoint-matching-is-not-a-substring
  %-  expect
  !>  ?&  (spaces:s 'ams3.digitaloceanspaces.com')
          !(spaces:s 'https://ams3.digitaloceanspaces.com.evil.example')
          !(spaces:s 'http://127.0.0.1:9000')  !(spaces:s 'https://s3.amazonaws.com')
      ==
--

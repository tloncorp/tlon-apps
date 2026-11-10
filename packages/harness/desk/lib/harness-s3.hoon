::  s3-client: reusable S3 upload client
::
::  provides AWS SigV4 signing and presigned PUT URL generation.
::  no agent dependencies — takes credentials as parameters.
::
|%
::
::  +s3-hmac-sha256: HMAC-SHA256 using shay
::
++  s3-hmac-sha256
  |=  [key=octs msg=octs]
  ^-  @
  =/  block-size=@ud  64
  =/  block-key=@
    ?:  (gth p.key block-size)
      (shay p.key q.key)
    q.key
  =/  ipad-key=@  (mix block-key (fil 3 block-size 0x36))
  =/  opad-key=@  (mix block-key (fil 3 block-size 0x5c))
  =/  inner-data=@  (can 3 ~[[64 ipad-key] [p.msg q.msg]])
  =/  inner-len=@ud  (add block-size p.msg)
  =/  inner-hash=@  (shay inner-len inner-data)
  =/  outer-data=@  (can 3 ~[[64 opad-key] [32 inner-hash]])
  =/  outer-len=@ud  (add block-size 32)
  (shay outer-len outer-data)
::
++  s3-hmac-sha256-cord
  |=  [key=@t msg=@t]
  ^-  @
  (s3-hmac-sha256 [(met 3 key) key] [(met 3 msg) msg])
::
::  +s3-signing-key: derive AWS4 signing key
::
++  s3-signing-key
  |=  [secret=@t date=@t region=@t service=@t]
  ^-  @
  =/  k-secret=@t  (rap 3 'AWS4' secret ~)
  =/  k-date=@  (s3-hmac-sha256-cord k-secret date)
  =/  k-region=@  (s3-hmac-sha256 [32 k-date] [(met 3 region) region])
  =/  k-service=@  (s3-hmac-sha256 [32 k-region] [(met 3 service) service])
  (s3-hmac-sha256 [32 k-service] [(met 3 'aws4_request') 'aws4_request'])
::
::  +s3-hex: convert 32-byte hash to hex cord
::
++  s3-hex
  |=  hash=@
  ^-  @t
  =/  out=tape
    =/  offset  0
    |-
    ?:  =(offset 32)  ~
    =/  byte=@  (cut 3 [offset 1] hash)
    =/  high  (snag (rsh 0^4 byte) "0123456789abcdef")
    =/  low  (snag (end 0^4 byte) "0123456789abcdef")
    [high low $(offset +(offset))]
  (crip out)
::
::  +s3-uri-encode: URI-encode a path for S3
::
++  s3-uri-encode
  |=  [cord=@t slash=?]
  ^-  @t
  %-  crip
  %-  zing
  %+  turn  (trip cord)
  |=  c=@t
  ^-  tape
  ?:  ?|  &((gte c 'a') (lte c 'z'))
          &((gte c 'A') (lte c 'Z'))
          &((gte c '0') (lte c '9'))
          =(c '-')  =(c '.')  =(c '_')  =(c '~')  &(slash =(c '/'))
      ==
    [c ~]
  =/  high  (snag (rsh 0^4 c) "0123456789ABCDEF")
  =/  low  (snag (end 0^4 c) "0123456789ABCDEF")
  ['%' high low ~]
::
::  SigV4 stays ship-side. Callers own dispatch, durable identity and retry policy.
+$  credentials
  [endpoint=@t access-key=@t secret-key=@t bucket=@t region=@t public-base=@t]
++  join
  |=  [base=@t key=@t]
  ^-  @t
  (rap 3 base ?:(=('/' (rsh [3 (dec (met 3 base))] base)) '' '/') key ~)
++  origin
  |=  raw=@t
  ^-  @t
  ?>  &((gth (met 3 raw) 0) (lte (met 3 raw) 2.048))
  ?>  !(lien (trip raw) |=(c=@t |((lte c 32) =(c '#') =(c '?') =(c '@'))))
  =/  url
    ?:  |(=('https://' (end 3^8 raw)) =('http://' (end 3^7 raw)))  raw
    (cat 3 'https://' raw)
  =/  parsed  (need (de-purl:html url))
  ?>  &(=(~ r.parsed) =([~ ~] q.parsed))
  (crip (head:en-purl:html p.parsed))
++  decode
  |=  [credential-json=json configuration-json=json]
  ^-  credentials
  =/  object  |=(value=json ?>(?=(%o -.value) p.value))
  =/  field
    |=  [value=json section=@t key=@t]
    ^-  @t
    =/  found
      %-  mole
      |.
      =/  fields  (object value)
      =/  update  (object (~(got by fields) 'storage-update'))
      =/  values  (object (~(got by update) section))
      (so:dejs:format (~(got by values) key))
    (fall found '')
  =/  service  (field configuration-json 'configuration' 'service')
  ?>  |(=('' service) =('credentials' service))
  =/  config=credentials
    :*  (field credential-json 'credentials' 'endpoint')
        (field credential-json 'credentials' 'accessKeyId')
        (field credential-json 'credentials' 'secretAccessKey')
        (field configuration-json 'configuration' 'currentBucket')
        (field configuration-json 'configuration' 'region')
        (field configuration-json 'configuration' 'publicUrlBase')
    ==
  =?  region.config  =('' region.config)  'us-east-1'
  ?>  ?&  !=('' access-key.config)
          !=('' secret-key.config)
          !=('' bucket.config)
      ==
  ?>  ?&  (gte (met 3 bucket.config) 3)
          (lte (met 3 bucket.config) 63)
          !=('.' bucket.config)
          !=('..' bucket.config)
      ==
  ?>  %+  levy  (trip bucket.config)
      |=  c=@t
      ?|  &((gte c 'a') (lte c 'z'))
          &((gte c '0') (lte c '9'))
          =('-' c)
          =('.' c)
      ==
  =.  endpoint.config
    %-  origin
    ?:  =('' endpoint.config)
      (rap 3 'https://s3.' region.config '.amazonaws.com' ~)
    endpoint.config
  ?.  =('' public-base.config)
    ?>  ?&  (lte (met 3 public-base.config) 2.048)
            !(lien (trip public-base.config) |=(c=@t |((lte c 32) =(c '#') =(c '?') =(c '@'))))
        ==
    =/  parsed  (need (de-purl:html public-base.config))
    ?>  =(~ r.parsed)
    config
  config
++  spaces
  |=  endpoint=@t
  ^-  ?
  =/  parsed  (need (de-purl:html (origin endpoint)))
  ?:  ?=(%| -.r.p.parsed)  |
  =/  labels  p.r.p.parsed
  ?.  ?=([@ @ ^] labels)  |
  &(=('com' i.labels) =('digitaloceanspaces' i.t.labels))
++  presign
  |=  [config=credentials now=@da key=@t mime=@t acl=?]
  ^-  [url=@t public-url=@t headers=(list [@t @t])]
  =/  date-parts=date  (yore now)
  =/  pad  |=(n=@ud ^-(tape ?:((lth n 10) "0{(a-co:co n)}" (a-co:co n))))
  =/  day=@t  (crip "{(a-co:co y.date-parts)}{(pad m.date-parts)}{(pad d.t.date-parts)}")
  =/  stamp=@t
    %-  crip
    "{(trip day)}T{(pad h.t.date-parts)}{(pad m.t.date-parts)}{(pad s.t.date-parts)}Z"
  =/  base  (origin endpoint.config)
  =/  host  (rsh [3 ?:(=('https://' (end 3^8 base)) 8 7)] base)
  =/  object-path  (s3-uri-encode (rap 3 '/' bucket.config '/' key ~) &)
  =/  public-url
    ?:  =('' public-base.config)  (cat 3 base object-path)
    (join public-base.config (s3-uri-encode key &))
  =/  scope  (rap 3 day '/' region.config '/s3/aws4_request' ~)
  =/  credential  (s3-uri-encode (rap 3 access-key.config '/' scope ~) |)
  ::  Spaces requires the ACL on the wire, not only in the presigned query.
  ::  Sign that header too. Other providers use the ACL query parameter.
  =/  wire-acl  &(acl (spaces base))
  =/  signed  (cat 3 'cache-control;content-type;host' ?:(wire-acl ';x-amz-acl' ''))
  =/  query
    %-  rap
    :-  3
    :~  'X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential='
        credential
        '&X-Amz-Date='
        stamp
        '&X-Amz-Expires=300&X-Amz-SignedHeaders='
        (s3-uri-encode signed |)
        ?:(acl '&x-amz-acl=public-read' '')
    ==
  =/  canonical
    %-  rap
    :-  3
    :~  'PUT\0a'
        object-path
        '\0a'
        query
        '\0acache-control:public, max-age=3600\0acontent-type:'
        mime
        '\0ahost:'
        host
        '\0a'
        ?:(wire-acl 'x-amz-acl:public-read\0a' '')
        '\0a'
        signed
        '\0aUNSIGNED-PAYLOAD'
    ==
  =/  digest  (s3-hex (shay (met 3 canonical) canonical))
  =/  to-sign  (rap 3 'AWS4-HMAC-SHA256\0a' stamp '\0a' scope '\0a' digest ~)
  =/  signing-key  (s3-signing-key secret-key.config day region.config 's3')
  =/  signature  (s3-hex (s3-hmac-sha256 [32 signing-key] [(met 3 to-sign) to-sign]))
  :*  (rap 3 base object-path '?' query '&X-Amz-Signature=' signature ~)
      public-url
      %+  weld
        ~[['Content-Type' mime] ['Cache-Control' 'public, max-age=3600']]
      ?:(wire-acl ~[['x-amz-acl' 'public-read']] ~)
  ==
--

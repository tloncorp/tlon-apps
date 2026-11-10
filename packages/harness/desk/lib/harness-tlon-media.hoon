::  Pure media boundary helpers; network effects belong to the Tlon hand.
/-  t=harness-tlon
/+  s3=harness-s3
|%
++  hosted
  |=  config=json
  ^-  ?
  ?>  ?=(%o -.config)
  =/  update  (~(got by p.config) 'storage-update')
  ?>  ?=(%o -.update)
  =/  values  (~(got by p.update) 'configuration')
  ?>  ?=(%o -.values)
  =/  service  (so:dejs:format (~(got by p.values) 'service'))
  ?>  |(=('credentials' service) =('presigned-url' service))
  =('presigned-url' service)
++  hosted-request
  |=  [ship=@p token=@t key=@t mime=@t size=@ud]
  ^-  request:http
  ::  The ship identity token goes only to Tlon's fixed broker, never to a
  ::  model-selected URL, configurable storage endpoint or image source.
  =/  name  (rsh 3^1 (scot %p ship))
  =/  url  (rap 3 'https://memex.tlon.network/v1/' name '/upload' ~)
  =/  body
    %-  en:json:html
    %-  pairs:enjs:format
    :~  ['token' %s token]
        ['contentLength' (numb:enjs:format size)]
        ['contentType' %s mime]
        ['fileName' %s key]
    ==
  [%'PUT' url ~[['Content-Type' 'application/json']] `(as-octs:mimes:html body)]
++  hosted-response
  |=  reply=client-response:iris
  ^-  [url=@t public-url=@t]
  |^
    ?>  ?=(%finished -.reply)
    ?>  &(=(200 status-code.response-header.reply) ?=(^ full-file.reply))
    ?>  (lte p.data.u.full-file.reply 16.384)
    =/  value  (need (de:json:html q.data.u.full-file.reply))
    =/  target=[url=@t public-url=@t]
      ((ot:dejs:format ~[['url' so:dejs:format] ['filePath' so:dejs:format]]) value)
    =/  signed  (checked-url url.target)
    =/  public  (checked-url public-url.target)
    ?>  &(!=(~ r.signed) =(~ r.public) =(q.signed q.public))
    [url.target public-url.target]
  ::
  ++  checked-url
    |=  raw=@t
    ^-  purl:eyre
    ?>  &((lte (met 3 raw) 8.192) !(lien (trip raw) |=(c=@t |((lte c 32) =(c '#')))))
    =/  parsed  (need (de-purl:html raw))
    ::  Memex returns GCS URLs. No arbitrary HTTP destination can be
    ::  introduced at this boundary, even by a malformed broker response.
    ?>  =('https://storage.googleapis.com' (crip (head:en-purl:html p.parsed)))
    parsed
  --
++  download-request
  |=  raw=@t
  ^-  request:http
  ?>  &((lte (met 3 raw) 2.048) =('https://' (end 3^8 raw)))
  ?>  !(lien (trip raw) |=(c=@t |((lte c 32) (gte c 127) =(c '#') =(c '@') =(c 92))))
  =/  parsed  (need (de-purl:html raw))
  ?>  &(p.p.parsed =(~ q.p.parsed) ?=(%& -.r.p.parsed))
  =/  labels=(list @t)  +.r.p.parsed
  ?>  (gte (lent labels) 2)
  ?>  (levy labels dns-label)
  ::  Only ordinary qualified DNS names, never IP literals or local names.
  ::  Iris has no DNS-answer/IP-pinning API: this is a URL boundary, not a
  ::  guarantee about resolved addresses. TLS verification remains native.
  ?>  ?!  %+  lien  labels
          |=  label=@t
          ?|  =('localhost' label)
              =('local' label)
              =('internal' label)
              =('intranet' label)
              =('lan' label)
              =('home' label)
              =('arpa' label)
              =('invalid' label)
              =('test' label)
          ==
  :*  %'GET'
      raw
      :~  ['Accept' 'image/png,image/jpeg,image/gif,image/webp']
          ['Accept-Encoding' 'identity']
      ==
      ~
  ==
++  dns-label
  |=  label=@t
  ^-  ?
  ?:  |(=('' label) (gth (met 3 label) 63))  |
  %+  levy  (trip label)
  |=  c=@t
  ?|  &((gte c 'a') (lte c 'z'))
      &((gte c '0') (lte c '9'))
      =(c '-')
  ==
++  image-type
  |=  data=octs
  ^-  (unit @t)
  ?.  &((gte p.data 12) (lte p.data 8.388.608))  ~
  ?:  =(0xa1a.0a0d.474e.5089 (end 3^8 q.data))  `'image/png'
  ?:  =(0xff.d8ff (end 3^3 q.data))  `'image/jpeg'
  ?:  |(=('GIF87a' (end 3^6 q.data)) =('GIF89a' (end 3^6 q.data)))  `'image/gif'
  ?:  &(=('RIFF' (end 3^4 q.data)) =('WEBP' (cut 3 [8 4] q.data)))  `'image/webp'
  ~
++  file-type
  |=  raw=@t
  ^-  @t
  ::  Iris preserves MIME parameters; storage signing needs the base type.
  =/  chars  (cass (trip raw))
  =/  base=tape
    |-  ^-  tape
        ?~  chars  ~
        ?:  =(';' i.chars)  ~
        [i.chars $(chars t.chars)]
  (crip (skip base |=(c=@t |(=(c 32) =(c 9)))))
++  file-extension
  |=  mime=@t
  ^-  @t
  ?+  mime  !!
    %'image/png'  'png'
    %'image/jpeg'  'jpg'
    %'image/gif'  'gif'
    %'image/webp'  'webp'
    %'text/plain'  'txt'
    %'text/markdown'  'md'
    %'text/csv'  'csv'
    %'application/json'  'json'
    %'application/pdf'  'pdf'
    %'application/zip'  'zip'
    %'application/octet-stream'  'bin'
    %'audio/mpeg'  'mp3'
    %'audio/ogg'  'ogg'
    %'audio/wav'  'wav'
    %'video/mp4'  'mp4'
  ==
++  file-valid
  |=  [mime=@t data=octs]
  ^-  ?
  ?.  &((gth p.data 0) (lte p.data 8.388.608) (lte (met 3 q.data) p.data))  |
  ?~  (mole |.((file-extension mime)))  |
  ?:  =('image/' (end [3 6] mime))  =(`mime (image-type data))
  ?:  =('application/pdf' mime)  =('%PDF-' (end [3 5] q.data))
  &(!=('<!DOCTYPE html' (end [3 14] q.data)) !=('<html' (end [3 5] q.data)))
++  acl-rejected
  |=  reply=client-response:iris
  ^-  ?
  ?.  ?=(%finished -.reply)  |
  ?.  &(=(400 status-code.response-header.reply) ?=(^ full-file.reply))  |
  ?.  (lte p.data.u.full-file.reply 16.384)  |
  ::  A positive rejection permits one ACL-free PUT. Transport errors and
  ::  arbitrary 400 responses never imply that replay is safe.
  =/  body  (trip q.data.u.full-file.reply)
  ?=(^ (find "<Code>AccessControlListNotSupported</Code>" body))
++  result
  |=  [url=@t mime=@t]
  ^-  @t
  =/  note
    ?:  =('image/' (end [3 6] mime))
      'Upload accepted. Use ![description](url) on its own line in your final reply to publish an image. Public access depends on the storage configuration.'
    'Upload accepted. Share [filename](url) only with the intended recipients. Access depends on storage configuration and may be public.'
  %-  en:json:html
  %-  pairs:enjs:format
  :~  ['url' %s url]
      ['content_type' %s mime]
      ['note' %s note]
  ==
--

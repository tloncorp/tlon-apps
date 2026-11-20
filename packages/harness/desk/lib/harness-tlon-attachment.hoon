::  A sent message's content as the app and the production CLI write it: a
::  gallery link post is a bare link card, and files and videos ride in the
::  post's blob as typed entries (docs/tlon-apps/post-blobs.md in tlon-apps).
::  Sizes are unknown without fetching the file, which the CLI also records
::  as -1.
/-  t=harness-tlon, dv=channels-ver, meta
/+  spec=harness-tlon-tool, story=harness-tlon-story
|%
+$  message  [content=story:v9:dv meta=(unit data:meta) blob=(unit @t)]
::
++  compose
  |=  [args=json to=destination:t]
  ^-  (each message @t)
  =/  text  (string:spec args 'text' '' 16.384)
  =/  link  (string:spec args 'link' '' 2.048)
  =/  title  (string:spec args 'title' '' 128)
  =/  gallery  &(?=(%channel -.to) ?=(%heap kind.nest.to) ?=(~ parent.to))
  =/  given
    %+  skim  `(list @t)`~['file' 'video']
    |=(key=@t !=('' (string:spec args key '' 2.048)))
  =/  entries  (turn given |=(key=@t (entry key (string:spec args key '' 2.048))))
  ?:  (lien entries |=(value=(unit json) ?=(~ value)))
    [%| 'file and video take a public https URL without credentials']
  =/  blob=(unit @t)
    ?~(entries ~ `(en:json:html [%a (turn entries need)]))
  ?.  |(gallery =('' title))  [%| 'title is only for gallery posts']
  ?.  =('' link)
    ?.  gallery
      [%| 'link posts a link card to a gallery (heap) channel; put links in text elsewhere']
    ?.  &(=('' text) ?=(~ given))
      [%| 'a gallery link post has only the link and an optional title']
    ?~  (address link |)  [%| 'link takes an http(s) URL without credentials']
    =/  card-meta  ?:(=('' title) ~ (my ~[[%title title]]))
    [%& ~[[%block %link link card-meta]] ?:(=('' title) ~ `[title '' '' '']) ~]
  ?:  &(=('' text) ?=(~ given))  [%| 'send text, or a file or video']
  ?:  &(gallery (gth (lent given) 1))  [%| 'a gallery post takes one attachment']
  [%& (text-to-story:story text) ?:(=('' title) ~ `[title '' '' '']) blob]
::
::  +address: a URL's decoded file name, when it is acceptable to send
::
++  address
  |=  [url=@t secure=?]
  ^-  (unit @t)
  =/  parsed  (de-purl:html url)
  ?~  parsed  ~
  ?:  &(secure !p.p.u.parsed)  ~
  =/  scheme=@ud
    ?:  =('https://' (end 3^8 url))  8
    ?:  =('http://' (end 3^7 url))  7
    0
  ?:  =(0 scheme)  ~
  ::  Refuse credentials before the host, as the CLI does.
  =/  rest  (trip (rsh 3^scheme url))
  ?:  ?=(^ (find "@" (scag (fall (find "/" rest) (lent rest)) rest)))  ~
  ?~  q.q.u.parsed  `''
  ::  de-purl splits the extension off the last segment.
  `(cat 3 (rear q.q.u.parsed) ?~(p.q.u.parsed '' (cat 3 '.' u.p.q.u.parsed)))
::
++  entry
  |=  [kind=@t url=@t]
  ^-  (unit json)
  =/  name  (address url &)
  ?~  name  ~
  :-  ~
  %-  pairs:enjs:format
  :*  ['type' %s kind]
      ['version' (numb:enjs:format 1)]
      ['fileUri' %s url]
      ['size' %n '-1']
      ?:(=('' u.name) ~ ~[['name' %s u.name]])
  ==
--

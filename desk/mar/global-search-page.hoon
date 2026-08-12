/-  gs=global-search
=>  |%
    +$  jsn  json
    --
|_  =page:gs
++  grad  %noun
++  grow
  |%
  ++  noun  page
  ++  json
    =,  enjs:format
    %-  pairs
    :~  'hits'^a+(turn hits.page hit-json)
        'next'^?~(next.page ~ s+(scot %uw (jam u.next.page)))
        'complete'^b+complete.page
        'indexed'^(numb indexed.page)
        'sources'^(source-counts-json sources.page)
        'builtAt'^?~(built-at.page ~ s+(scot %da u.built-at.page))
    ==
  --
++  grab
  |%
  ++  noun  page:gs
  --
::
++  hit-json
  |=  =hit:gs
  ^-  jsn
  =,  enjs:format
  %-  pairs
  :~  'ref'^(ref-json ref.hit)
      'sent'^s+(scot %da sent.hit)
      'author'^s+(scot %p author.hit)
      'snippet'^s+snippet.hit
  ==
::
++  source-counts-json
  |=  =source-counts:gs
  ^-  jsn
  =,  enjs:format
  %-  pairs
  :~  'channels'^(numb channels.source-counts)
      'clubs'^(numb clubs.source-counts)
      'dms'^(numb dms.source-counts)
  ==
::
++  ref-json
  |=  =ref:gs
  ^-  jsn
  =,  enjs:format
  %-  pairs
  :~  'source'^(source-json source.ref)
      'top'^s+(scot %ud top.ref)
      'reply'^?~(reply.ref ~ s+(scot %ud u.reply.ref))
  ==
::
++  source-json
  |=  =source:gs
  ^-  jsn
  =,  enjs:format
  ?-  -.source
    %dm
      %-  pairs
      ~['type'^s+'dm' 'ship'^s+(scot %p ship.source)]
    %club
      %-  pairs
      ~['type'^s+'club' 'id'^s+(scot %uv id.source)]
    %channel
      %-  pairs
      :~  'type'^s+'channel'
          'kind'^s+(scot %tas kind.nest.source)
          'ship'^s+(scot %p ship.nest.source)
          'name'^s+name.nest.source
      ==
  ==
--

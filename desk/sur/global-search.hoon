/-  c=chat, d=channels
|%
::  A conversation containing a searchable message.
::
+$  source
  $%  [%channel =nest:d]
      [%dm =ship]
      [%club id=@uv]
  ==
::  A stable coordinate for a top-level message or reply.
::
+$  ref
  $:  =source
      top=time
      reply=(unit time)
  ==
::  Document ids make posting keys compact.  Cursors are scoped to one index
::  build; consumers restart pagination when .built-at changes.
::
+$  cursor  [sent=time id=@ud]
::  Search results deliberately carry no full post noun.  Consumers can use
::  the existing around/message scries after selecting a hit.
::
+$  hit
  $:  =cursor
      =ref
      sent=time
      author=ship
      snippet=@t
  ==
+$  source-counts  [channels=@ud clubs=@ud dms=@ud]
+$  page
  $:  hits=(list hit)
      next=(unit cursor)
      complete=?
      indexed=@ud
      sources=source-counts
      built-at=(unit time)
  ==
--

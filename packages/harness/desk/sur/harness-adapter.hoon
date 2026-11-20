::  Owner-side ACP delegation envelope. The head routes, the adapter owns its
::  config and replies through ACP. No adapter state enters the session store.
/-  h=harness
|%
+$  request  [connection=@t id=json method=@t params=(unit json)]
::  Concrete hands execute only a matching outstanding head request. The
::  provider request counter prevents reused call IDs accepting old receipts.
+$  tool-request  [sid=@t generation=@ud call=tool-call:h]
+$  tool-authority  [call=tool-call:h tools=(list tool-grant:h)]
+$  hand-authority  [live=? ceiling=(unit (list tool-grant:h))]
--

::  An ordered forest of immutable summaries. Edges name older nodes or
::  original event addresses; descendants are never copied into each parent.
::  A summary is lossy. Its retained sources, not its prose, are the evidence.
|%
+$  node
  $:  id=@ud
      depth=@ud
      body=@t
      sources=(list @ud)
      children=(list @ud)
  ==
+$  forest  [nodes=(map @ud node) roots=(list @ud)]
--

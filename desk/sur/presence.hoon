::  presence: short-lived personal activity types
::
|%
+$  places    (map context topics)
+$  topics    (map topic people)
+$  people    (map ship [timing display])
::
+$  context   path  ::  nest path or other
+$  topic     ?(%typing %computing %other)  ::TODO  @ ?
+$  key       [=context =ship =topic]
+$  timing    [since=@da timeout=(unit @dr)]
+$  display   [icon=(unit @t) text=(unit @t) blob=(unit @t)]
::
+$  action-1  ::  from client to local agent
  $%  [%set disclose=(set ship) =key timeout=(unit @dr) =display]
      [%clear =key]
      [%nuke =context]
  ==
::
+$  command-1  ::  from anyone to context host
  $%  [%set disclose=(set ship) =key =timing =display]
      [%clear =key]  ::  clear early
  ==
::
+$  update-1  ::  context host to subscribers
  $%  [%set =key =timing =display]
      [%clear =key]
  ==
::
+$  response-1  ::  local agent to client
  $%  [%init =places]
      [%here =key =timing =display]
      [%gone =key]
  ==
--

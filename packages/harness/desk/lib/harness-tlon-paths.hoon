::  Native read addresses. Callers select protocol and page bounds.
|_  [our=@p now=@da]
++  dm-writs
  |=  who=@p
  ^-  path
  /(scot %p our)/chat/(scot %da now)/v4/dm/(scot %p who)/writs
::
++  dm-post
  |=  [who=@p id=[@p @da]]
  ^-  path
  %+  weld  (dm-writs who)
  /writ/id/(scot %p -.id)/(scot %ud +.id)/chat-writ-4
::
++  channel-posts
  |=  [version=@tas nest=[kind=@tas ship=@p name=@tas]]
  ^-  path
  (weld (channel version nest) /posts)
::
++  channel-replies
  |=  [version=@tas nest=[kind=@tas ship=@p name=@tas] parent=@da]
  ^-  path
  %+  weld  (channel-posts version nest)
  /post/id/(scot %ud parent)/replies
::
++  channel
  |=  [version=@tas nest=[kind=@tas ship=@p name=@tas]]
  ^-  path
  /(scot %p our)/channels/(scot %da now)/[version]/[kind.nest]/(scot %p ship.nest)/[name.nest]
::
++  channel-permissions
  |=  nest=[kind=@tas ship=@p name=@tas]
  ^-  path
  %+  weld
    /(scot %p our)/channels/(scot %da now)/[kind.nest]/(scot %p ship.nest)/[name.nest]
  /perm/channel-perm
::
++  club-post
  |=  [club=@uv id=[@p @da]]
  ^-  path
  %+  weld  /(scot %p our)/chat/(scot %da now)/v4/club/(scot %uv club)/writs
  /writ/id/(scot %p -.id)/(scot %ud +.id)/chat-writ-4
::
++  group-can-read
  |=  flag=[@p @tas]
  ^-  path
  %+  weld  /(scot %p our)/groups/(scot %da now)/v2/groups/(scot %p -.flag)/[+.flag]
  /channels/can-read/noun
--

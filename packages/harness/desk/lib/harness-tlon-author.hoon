::  Tlon message authors: a bare ship, or a bot profile.
/-  dv=channels-ver
|%
::  +bot-author: author of every message the bot writes
::
::    the profile form marks it as a bot's; apps take the name and avatar
::    from contacts.
++  bot-author
  |=  our=@p
  ^-  author:v9:dv
  [our ~ ~]
::  +author-ship: the ship that wrote a message, in either author form
++  author-ship
  |=  =author:v9:dv
  ^-  @p
  ?@(author author ship.author)
--

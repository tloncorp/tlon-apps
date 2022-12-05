|%
+$  release  ?(%stable %alpha)
++  parse    (perk %stable %alpha ~)
++  whit     (star gah)

--
|_  r=release
++  grad  %noun
++  grow
  |%
  ++  mime  [/text/x-release (as-octs:mimes:html r)]
  ++  noun  r
  ++  json  s/r
  --
++  grab
  |%
  +$  noun  release
  ++  json  (su:dejs:format parse)
  ++  mime  
    |=  [=mite len=@ud tex=@]
    `release`(rash tex (ifix [whit whit] parse))
  --
--

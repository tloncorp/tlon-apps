/-  j=jibe 
/+  cite=cite-json
|%
++  enjs
  =,  enjs:format
  |%
  ++  jibe
    |=  =jibe:j
    %-  pairs
    :~  block/a/(turn p.jibe block)
        inline/a/(turn q.jibe inline)
    ==
  ++  inline
    |=  i=inline:j
    ^-  json
    ?@  i  s/i
    %+  frond  -.i
    ?-  -.i
        %break
      ~
    ::
        %ship  s/(scot %p p.i)
    ::
        ?(%code %tag %inline-code)
      s+p.i
    ::
        ?(%italics %bold %strike %blockquote)
      :-  %a
      (turn p.i inline)
    ::
        %block
      %-  pairs
      :~  index+(numb p.i)
          text+s+q.i
      ==
    ::
        %link
      %-  pairs
      :~  href+s+p.i
          content+s+q.i
      ==
    ==
  ::
  ++  block
    |=  b=block:j
    ^-  json
    %+  frond  -.b
    ?-  -.b
        %cite  (enjs:cite cite.b)
        %image
      %-  pairs
      :~  src+s+src.b
          height+(numb height.b)
          width+(numb width.b)
          alt+s+alt.b
      ==
    ==
  --
++  dejs
  =,  dejs:format
  |%
  ++  jibe
    ^-  $-(json jibe:j)
    %-  ot
    :~  block/(ar block)
        inline/(ar inline)
    ==
  ::
  ++  block
    ^-  $-(json block:j)
    %-  of
    :~  cite/dejs:cite
    ::
      :-  %image
      %-  ot
      :~  src/so
          height/ni
          width/ni
          alt/so
      ==
    ==
  ::
  ++  inline
    |=  jon=json
    ^-  inline:j
    ?:  ?=([%s *] jon)  p.jon
    =>  .(jon `json`jon)
    %.  jon
    %-  of
    :~  italics/(ar inline)
        bold/(ar inline)
        strike/(ar inline)
        ship/(se %p)
        blockquote/(ar inline)
        inline-code/so
        code/so
        tag/so
        break/ul
    ::
      :-  %block
      %-  ot
      :~  index/ni
          text/so
      ==
    ::
      :-  %link
      %-  ot
      :~  href/so
          content/so
      ==
    ==
  --
--

/-  verifier
=,  (verifier)
|_  upd=update:l
++  grad  %noun
++  grow
  |%
  ++  noun  upd
  ++  json
    =,  enjs:format
    %+  frond  -.upd
    =/  value
      |=  id=identifier
      ?+(-.id +.id %urbit (scot %p +.id), %website (en-turf:html +.id))
    =/  status
      |=  status=$%([%gone why=@t] status)
      ?-(-.status %gone 'gone', %done 'verified', %wait 'waiting', %want 'pending')
    ?-  -.upd
        %query
      %-  pairs
      :~  'nonce'^s+(scot %uv nonce.upd)
          'result'^s+'stub'  ::TODO
      ==
    ::
        %status
      %-  pairs
      :*  'provider'^s+(scot %p host.upd)
          'type'^s+-.id.upd
          'value'^s+(value id.upd)
          'status'^s+(status status.upd)
        ::
          ?.  ?=(%gone -.status.upd)  ~
          ['gone' s+why.status.upd]~
      ==
    ::
        %config
      %-  pairs
      :~  'provider'^s+(scot %p host.upd)
          'type'^s+-.id.upd
          'value'^s+(value id.upd)
          'visibility'^s+config.upd
      ==
    ::
        %full
      :-  %a
      %+  turn  ~(tap by all.upd)
      |=  [[host=@p id=identifier] id-state]
      %-  pairs
      :~  'provider'^s+(scot %p host)
          'type'^s+-.id
          'value'^s+(value id)
          'status'^s+(^status status)
          'visibility'^s+config
      ==
    ==
  --
++  grab
  |%
  +$  noun  update:l
  --
--

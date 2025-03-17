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
      |=  status=$%([%gone ~] status)
      ?-(-.status %gone 'gone', %done 'verified', %wait 'waiting', %want 'pending')
    ?-  -.upd
        %query
      %-  pairs
      :~  'nonce'^s+(scot %uv nonce.upd)
        ::
          :-  'result'
          %+  frond  +>-.upd
          ?-  +>-.upd
            %fail     s+why.upd
            %has-any  b+has.upd
            %valid    b+valid.upd
            %whose    ?~(who.upd ~ s+(scot %p u.who.upd))
          ::
              %valid-jam
            %-  pairs
            ?^  valid.upd
              ~['valid'^b+sig 'live'^b+liv]:valid.upd
            =/  liv=^json  ?:(valid.upd ~ b+|)
            ~['valid'^b+valid.upd 'live'^~]
          ::
              %whose-bulk
            %-  pairs
            =;  results
              :~  'next-salt'^s+(scot %ux next-salt.upd)
                  'results'^(pairs results)
              ==
            %+  turn  ~(tap by who.upd)
            |=  [id=identifier who=(unit @p)]
            [(value id) ?~(who ~ s+(scot %p u.who))]
          ==
      ==
    ::
        %status
      %-  pairs
      :~  'provider'^s+(scot %p host.upd)
          'type'^s+-.id.upd
          'value'^s+(value id.upd)
          'status'^s+(status status.upd)
          'why'^s+why.upd
      ==
    ::
        %config
      %-  pairs
      :~  'provider'^s+(scot %p host.upd)
          'type'^s+-.id.upd
          'value'^s+(value id.upd)
          'config'^o+['discoverable'^s+config.upd ~ ~]
      ==
    ::
        %full
      :-  %a
      %+  turn  ~(tap by all.upd)
      |=  [[host=@p id=identifier] =config why=@t =^status]
      %-  pairs
      :~  'provider'^s+(scot %p host)
          'type'^s+-.id
          'value'^s+(value id)
          'status'^s+(^status status)
          'config'^o+['discoverable'^s+config ~ ~]
          'why'^s+why
      ==
    ==
  --
++  grab
  |%
  +$  noun  update:l
  --
--

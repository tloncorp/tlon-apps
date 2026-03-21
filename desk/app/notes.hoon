/-  notes
/+  default-agent, dbug, verb
|%
+$  card  card:agent:gall
+$  state-0  state-0:notes
+$  raw-state
  $:  notebooks=(map @ud notebook:notes)
      folders=(map @ud folder:notes)
      notes=(map @ud note:notes)
      members=(map @ud notebook-members:notes)
      next-id=@ud
  ==
--
=|  state=raw-state
%-  agent:dbug
%+  verb  |
^-  agent:gall
=<
|_  =bowl:gall
+*  this  .
    def   ~(. (default-agent this %|) bowl)
++  on-init
  ^-  (quip card _this)
  `this
++  on-save
  ^-  vase
  !>([%0 state])
++  on-load
  |=  old=vase
  ^-  (quip card _this)
  =/  s=state-0:notes  !<(state-0:notes old)
  :_  this(state [notebooks.s folders.s notes.s members.s next-id.s])
  ~
++  on-poke
  |=  [poke-mark=term poke-vase=vase]
  ^-  (quip card _this)
  ?+  poke-mark  (on-poke:def poke-mark poke-vase)
      %notes-action
    ?>  =(our src):bowl
    =/  act=action:notes
      !<(action:notes poke-vase)
    ?-  -.act
        %create-notebook
      =/  nid=@ud  +(next-id.state)
      =/  rfid=@ud  +(nid)
      =/  mbrs=notebook-members:notes
        (~(put by *(map ship role:notes)) src.bowl %owner)
      =/  nb=notebook:notes
        [nid title.act src.bowl now.bowl now.bowl]
      =/  rf=folder:notes
        [rfid nid '/' ~ src.bowl now.bowl now.bowl]
      =/  next=raw-state
        %_  state
          notebooks  (~(put by notebooks.state) nid nb)
          folders    (~(put by folders.state) rfid rf)
          members    (~(put by members.state) nid mbrs)
          next-id    rfid
        ==
      :_  this(state next)
      ~
    ::  all other cases return unchanged
      %rename-notebook   `this
      %invite-member     `this
      %remove-member     `this
      %set-role          `this
      %create-folder     `this
      %rename-folder     `this
      %move-folder       `this
      %delete-folder     `this
      %create-note       `this
      %rename-note       `this
      %move-note         `this
      %delete-note       `this
      %update-note       `this
    ==
  ==
++  on-peek   on-peek:def
++  on-watch  on-watch:def
++  on-agent  on-agent:def
++  on-arvo   on-arvo:def
++  on-leave  on-leave:def
++  on-fail   on-fail:def
--
|%
++  placeholder  ~
--

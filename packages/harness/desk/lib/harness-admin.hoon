::  Administrative provenance is identity, not a configurable tool grant.
::  Tickets are local correlation only; the head rechecks live authority.
/-  h=harness
|%
+$  ticket  [sid=session-id:h generation=@ud call-id=@t]
++  connection
  |=  request=ticket
  ^-  @t
  (cat 3 'admin--' (scot %uv (jam request)))
++  decode
  |=  name=@t
  ^-  (unit ticket)
  ?.  &((lte (met 3 name) 4.096) =('admin--' (end [3 7] name)))  ~
  =/  raw  (slaw %uv (rsh [3 7] name))
  ?~  raw  ~
  =/  parsed  (mule |.(;;(ticket (cue u.raw))))
  ?:(?=(%& -.parsed) `p.parsed ~)
::  Input markers end the search; only received inputs carry provenance.
++  current-input
  |=  log=(list event:h)
  ^-  (unit admitted-input:h)
  ?~  log  ~
  ?:  ?=(%input-admitted -.i.log)  ~
  ?.  ?=(%input-received -.i.log)  $(log t.log)
  `input.i.log
++  origin
  |=  [log=(list event:h) our=@p owner=(unit @p)]
  ^-  (unit term)
  =/  input  (current-input log)
  ?~  input  ~
  =/  source  source.u.input
  ?+  -.source  ~
    %acp  ?:(=(`our actor.u.input) `%local ~)
      %poke
    ?.  &(=(ship.source our) =(`our actor.u.input))  ~
    `%local
      %peer
    ?.  &(=(`ship.source owner) =(`ship.source actor.u.input))  ~
    `%peer
      %hand
    =/  actor  (slaw %p actor.source)
    ?.  &(?=(^ actor) =('tlon' hand.source) =(`u.actor owner))  ~
    ::  Public channels and schedules never inherit administrative access.
    =/  dm  (cat 3 'dm/' (scot %p u.actor))
    ?.  ?|  =(dm address.source)
            =((cat 3 dm '/') (end [3 (add 1 (met 3 dm))] address.source))
        ==
      ~
    `%tlon
  ==
++  peer-source
  |=  log=(list event:h)
  ^-  (unit @p)
  =/  input  (current-input log)
  ?~  input  ~
  =/  source  source.u.input
  ?:(?=(%peer -.source) `ship.source ~)
++  source-actor
  |=  log=(list event:h)
  ^-  (unit @p)
  =/  input  (current-input log)
  ?~  input  ~
  =/  source  source.u.input
  ?+  -.source  ~
    %peer  `ship.source
    %hand  (slaw %p actor.source)
  ==
++  help
  ^-  @t
  %+  rap  3
  :~  'Full Harness administration. Read current settings before changing them; '
      'only perform changes requested by the owner. Never reveal credentials '
      'or private transcripts in public conversations. Parameters are JSON objects '
      'encoded as a string. Empty reads use {}.\0a\0a'
      'Read methods: harness/defaults, harness/tools, harness/status (provider), '
      'harness/peers, harness/peers/remote, harness/mcp/servers, harness/search, '
      'harness/summary-models, harness/skills, harness/skill (name), harness/tlon, '
      'harness/tlon/profile, harness/tlon/contacts, harness/cron, '
      'harness/tlon/work, session/list, harness/session/config (sessionId), '
      'harness/session/snapshot (sessionId), harness/session/history (sessionId, before).\0a\0a'
      'Configuration methods: harness/defaults/configure {config}; '
      'harness/session/configure {sessionId,config}; '
      'harness/session/use-default-model {sessionId}; '
      'harness/credential/set {provider,key}; harness/mcp/configure {servers}; '
      'harness/search/configure {config}; harness/summary-models/configure {models}; '
      'harness/peers/configure {revision,grants,limits,config}; '
      'harness/peers/reset {ship,revision}; harness/peers/check {ship}; '
      'harness/tlon/configure {enabled,owner,response,allowed,channels,trusted}; '
      'harness/tlon/owner/set {owner,expectedOwner,siblingMoonOwners,expectedSiblingMoonOwners}; '
      'harness/tlon/profile/set (read the profile first); '
      'harness/cron/add {id,binding,actor,kind,args}; '
      'harness/cron/edit {id,revision,args} replaces future timing/content; harness/cron/retry {id,input} resumes the failed lastInput with current credentials; harness/cron/cancel {id}; harness/cron/delete {id}; harness/cron/clear {id}. Read schedules first; only retry on an explicit human request, never uncertain delivery.\0a\0a'
      'Skills: harness/skill/save {name,desc,body}; harness/skill/delete {name}. '
      'Sessions: session/new {name,cwd:"/",mcpServers:[]}; session/delete {sessionId}; '
      'session/cancel {sessionId}; harness/session/rename {sessionId,name}; '
      'harness/session/fork {sessionId,name,eventCount}. '
      'Use help again whenever needed. Changing owner may end your own administrative access. '
      'This manages Harness, not the host operating system.'
  ==
--

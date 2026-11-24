::  A read capability, not a client session or effect authority. This module
::  has no conversation, scheduler, tool dispatch, or native mutation imports.
/-  pc=harness-project-client, w=harness-workspace
/+  j=harness-workspace-json, work=harness-workspace
|%
::
++  valid-key
  |=  key=@t
  ^-  ?
  ?&  =(68 (met 3 key))
      =('hpr_' (end [3 4] key))
      %+  levy  (trip (rsh [3 4] key))
      |=  char=@t
      ?|  &((gte char '0') (lte char '9'))
          &((gte char 'a') (lte char 'f'))
      ==
  ==
::
++  digest
  |=  key=@t
  ^-  @ux
  (shax key)
::
++  status
  |=  [credential=credential:pc archived=? now=@da]
  ^-  @t
  ?:  ?=(^ revoked.credential)  'revoked'
  ?:  (gte now expires.credential)  'expired'
  ?:  archived  'suspended'
  'active'
::
++  one
  |=  [id=@t credential=credential:pc archived=? now=@da]
  ^-  json
  %-  pairs:enjs:format
  :~  ['id' %s id]
      ['project' %s project.credential]
      ['label' %s label.credential]
      ['access' %s 'read-only']
      ['status' %s (status credential archived now)]
      ['created' (stamp:j created.credential)]
      ['expires' (stamp:j expires.credential)]
      ['revoked' ?~(revoked.credential ~ (stamp:j u.revoked.credential))]
  ==
::
++  owner-request
  |=  [db=state:pc workspace=state:w action=@t args=json now=@da]
  ^-  (each [db=state:pc result=json] @t)
  =/  project  (string:j args 'project')
  =/  record  (~(get by projects.workspace) project)
  ?~  record  [%| 'Project not found']
  ?:  =('clients' action)
    =/  rows
      %+  murn  ~(tap by db)
      |=  [id=@t credential=credential:pc]
      ?.  =(project project.credential)  ~
      `(one id credential archived.u.record now)
    [%& db (page:j rows args &)]
  =/  id  (string:j args 'id')
  ?.  (valid-id:work id)  [%| 'Invalid client credential ID']
  =/  found  (~(get by db) id)
  ?:  =('client-revoke' action)
    ?.  &(?=(^ found) =(project project.u.found))
      [%| 'Client credential not found in this project']
    ::  Repeating a revocation reports the same outcome, never reactivates it.
    =/  credential  u.found(revoked ?~(revoked.u.found `now revoked.u.found))
    [%& (~(put by db) id credential) (one id credential archived.u.record now)]
  ?.  =('client-create' action)  [%| 'Unknown client credential operation']
  ?:  archived.u.record  [%| 'Restore the project before issuing a client key']
  =/  key  (string:j args 'key')
  ?.  (valid-key key)  [%| 'Supply a browser-generated 256-bit project key']
  =/  label  (string:j args 'label')
  =/  days  (number:j args 'days' 7)
  ?.  ?&  (gth (met 3 label) 0)
          (lte (met 3 label) 128)
          (gte days 1)
          (lte days 30)
      ==
    [%| 'Use a label of 1–128 UTF-8 bytes and an expiry of 1–30 days']
  =/  hash  (digest key)
  ?^  found
    ::  An explicitly repeated identical create can recover its confirmation.
    ::  Never extend expiry, change scope, or revive a revoked/expired key.
    ?.  ?&  =(project project.u.found)
            =(label label.u.found)
            =(hash digest.u.found)
            =((mul days ~d1) (sub expires.u.found created.u.found))
            =('active' (status u.found archived.u.record now))
        ==
      [%| 'Credential identity already used; inspect its status or create a new key']
    [%& db (one id u.found archived.u.record now)]
  ?.  =((number:j args 'version' 0) version.u.record)
    [%| 'Project changed; review its current access before issuing a key']
  ?.  (lth ~(wyt by db) 256)  [%| 'Retained client credential capacity reached (256)']
  ?:  (lien ~(val by db) |=(credential=credential:pc =(hash digest.credential)))
    [%| 'This key was already used; generate a new key']
  =/  credential
    %*  .  *credential:pc
      project  project
      label  label
      digest  hash
      created  now
      expires  (add now (mul days ~d1))
    ==
  [%& (~(put by db) id credential) (one id credential | now)]
::
++  authenticate
  |=  [db=state:pc workspace=state:w key=@t now=@da]
  ^-  (unit [id=@t credential=credential:pc])
  ?.  (valid-key key)  ~
  =/  hash  (digest key)
  =/  rows  ~(tap by db)
  |-
  ^-  (unit [id=@t credential=credential:pc])
  ?~  rows  ~
  =/  [id=@t credential=credential:pc]  i.rows
  ?.  =(hash digest.credential)  $(rows t.rows)
  =/  project  (~(get by projects.workspace) project.credential)
  ?~  project  ~
  ?.  =('active' (status credential archived.u.project now))  ~
  `[id credential]
::
++  read-action
  |=  action=@t
  ^-  ?
  %+  lien
    ^-  (list @t)
    :~  'help'  'projects'  'project'  'artifacts'  'artifact'  'revisions'  'revision'  'proposals'
        'proposal'  'tasks'  'task'
    ==
  |=(item=@t =(item action))
::
++  view
  |=  [db=state:w project=@t]
  ^-  state:w
  =/  record  (~(got by projects.db) project)
  ?>  !archived.record
  ::  Disposable read projection only. Strip every other project, private
  ::  artifact, audit entry and membership before calling the existing reader.
  ::  The synthetic reader is never a saved member or mutation authority.
  =/  artifacts=(map @t artifact:w)
    %-  my
    %+  skim  ~(tap by artifacts.db)
    |=  [id=@t artifact=artifact:w]
    =(`project project.artifact)
  =/  proposals=(map @t proposal:w)
    %-  my
    %+  skim  ~(tap by proposals.db)
    |=  [id=@t proposal=proposal:w]
    (~(has by artifacts) artifact.proposal)
  =/  tasks=(map @t task:w)
    %-  my
    %+  skim  ~(tap by tasks.db)
    |=  [id=@t task=task:w]
    =(project project.task)
  =/  recency
    %-  my
    %+  skim  ~(tap by recency.db)
    |=  [key=record-key:w at=@da]
    ?:(=(%project kind.key) =(project id.key) (~(has by artifacts) id.key))
  %*  .  *state:w
    recency  recency
    artifacts  artifacts
    projects  (my ~[[project record(members (my ~[[0v1 %reader]]))]])
    proposals  proposals
    tasks  tasks
    writes  writes.db
  ==
::
++  read
  |=  [db=state:w project=@t action=@t args=json]
  ^-  (each json @t)
  ?.  (read-action action)  [%| 'This project key permits reads only']
  ?:  =('help' action)
    =/  actions
      %+  turn
        ^-  (list @t)
        :~  'projects'  'project'  'artifacts'  'artifact'  'revisions'  'revision'  'proposals'
            'proposal'  'tasks'  'task'
        ==
      |=  name=@t
      [%s name]
    :-  %&
    %-  pairs:enjs:format
    :~  ['access' %s 'read-only']
        ['project' %s project]
        ['actions' %a actions]
        :*  'limits'  %s
            'Lists: offset and limit 1–4. Bodies: offset and fixed revision, at most 8000 bytes. No conversations, tools, membership, credentials, approval, or publication.'
        ==
    ==
  =/  attempted
    %-  mule
    |.
    (read:j (view db project) [| [0v1 'Project reader'] 0v1] action args)
  ?.  ?=(%& -.attempted)  [%| 'Record unavailable in this project or invalid read parameters']
  [%& p.attempted]
::
++  header-key
  |=  headers=header-list:http
  ^-  (unit @t)
  =/  matches
    %+  skim  headers
    |=  [key=@t value=@t]
    =('authorization' (crip (cass (trip key))))
  ?.  =(1 (lent matches))  ~
  =/  value  value:(snag 0 matches)
  ?.  =('Bearer ' (end [3 7] value))  ~
  =/  key  (rsh [3 7] value)
  ?:((valid-key key) `key ~)
::
++  local-or-secure
  |=  inbound=inbound-request:eyre
  ^-  ?
  ?:  secure.inbound  &
  ?-  -.address.inbound
    %ipv4  =(.127.0.0.1 +.address.inbound)
    %ipv6  =(.0.0.0.0.0.0.0.1 +.address.inbound)
  ==
--

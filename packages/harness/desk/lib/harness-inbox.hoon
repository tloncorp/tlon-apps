::  An owner-only, disposable projection of retained work evidence. No log
::  replay, document reads, durable inbox state, scheduler or effect authority.
/-  w=harness-workspace, hh=harness-hand, cr=harness-cron, hn=harness-notes
/+  j=harness-workspace-json, snippets=harness-corpus-index
|%
+$  category  ?(%uncertain %blocked %approval %running %waiting %finished)
+$  source-kind  ?(%task %proposal %input %schedule %notes)
+$  position  [state=category at=@da kind=source-kind id=@t]
+$  selection  [counts=(map category @ud) rows=(list position)]
+$  filter  [state=@t kind=@t after=(unit position) limit=@ud]
++  rank
  |=  state=category
  ^-  @ud
  ?-  state
    %uncertain  0
    %blocked  1
    %approval  2
    %running  3
    %waiting  4
    %finished  5
  ==
++  attention
  |=  state=category
  ^-  ?
  (lth (rank state) 3)
++  before
  |=  [a=position b=position]
  ^-  ?
  ?:  !=(at.a at.b)  (gth at.a at.b)
  ?:  !=(kind.a kind.b)  (aor kind.a kind.b)
  &(!=(id.a id.b) (aor id.a id.b))
++  insert
  |=  [row=position rows=(list position) limit=@ud]
  ^-  (list position)
  ?:  =(0 limit)  ~
  ?~  rows  ~[row]
  ?:  (before row i.rows)  [row (scag (dec limit) `(list position)`rows)]
  [i.rows $(rows t.rows, limit (dec limit))]
++  select
  |=  [row=position out=selection state=@t kind=@t after=(unit position) limit=@ud]
  ^-  selection
  ?.  |(=('all' kind) =(kind kind.row))  out
  ::  Count every record of this source before filtering the visible page.
  =.  counts.out
    (~(put by counts.out) state.row +((fall (~(get by counts.out) state.row) 0)))
  ?.  ?|  =('all' state)
          =(state state.row)
          &(=('attention' state) (attention state.row))
      ==
    out
  ?:  ?~(after | !(before u.after row))  out
  out(rows (insert row rows.out limit))
++  input-state
  |=  [phase=phase:hh delivery=(unit delivery-state:hh)]
  ^-  category
  ::  A completed model turn does not settle a publication. Uncertainty
  ::  outranks execution, even after cancellation or owner intervention.
  ?:  =(`%uncertain delivery)  %uncertain
  ?:  =(`%failed delivery)  %blocked
  ?:  =(%failed phase)  %blocked
  ?:  ?~(delivery | ?=(?(%pending %claimed) u.delivery))  %waiting
  ?:  ?~(delivery | ?=(?(%delivered %abandoned) u.delivery))  %finished
  ?:  =(%running phase)  %running
  ?:  =(%queued phase)  %waiting
  ?:  =(%cancelled phase)  %finished
  ::  Completed execution with no outbox record is not delivery evidence.
  %waiting
++  task-state
  |=  task=task:w
  ^-  category
  ?-  status.task
    %open  %waiting
    %claimed  %waiting
    %blocked  %blocked
    %done  %finished
  ==
++  input-time
  |=  [at=@da publication=(unit publication:hh) control=(unit control:hh)]
  ^-  @da
  =?  at  ?=(^ publication)
    =/  latest
      %+  roll  receipts.u.publication
      |=  [receipt=receipt:hh latest=@da]
      (max at.receipt latest)
    (max at latest)
  ?~  control  at
  =/  latest
    %+  roll  resolutions.u.control
    |=  [resolution=resolution:hh latest=@da]
    (max at.resolution latest)
  (max at latest)
++  fence
  |=  [db=state:w hands=state:hh jobs=(map @uv schedule:cr) native=state:hn]
  ^-  @t
  ::  Hash compact lifecycle fields, never prompts, proposal bodies, session
  ::  logs or credentials. Any metadata edit fences paged navigation.
  =/  observations
    %+  turn  ~(tap by observations.hands)
    |=  [id=@uv observation=observation:hh]
    [id phase.observation]
  =/  publications
    %+  turn  ~(tap by outbox.hands)
    |=  [id=@uv publication=publication:hh]
    [id status.publication worker.publication external.publication (lent receipts.publication)]
  =/  controls
    %+  turn  ~(tap by controls.hands)
    |=  [id=@uv control=control:hh]
    [id attempt.control (lent resolutions.control)]
  =/  bindings
    %+  turn  ~(tap by bindings.hands)
    |=  [id=@t binding=binding:hh]
    [id sid.binding enabled.binding]
  =/  schedules
    %+  turn  ~(tap by jobs)
    |=  [id=@uv job=schedule:cr]
    [id state.job next.job remaining.job last.job]
  =/  pending
    ?~  pending.native  ~
    =*  pending  u.pending.native
    `[id.pending sent.pending uncertain.pending stage.pending]
  %+  scot
    %uv
  (sham [%recent-first writes.db observations publications controls bindings schedules pending])
++  encode
  |=  [token=@t state=@t kind=@t row=position]
  ^-  @t
  %-  en:json:html
  %-  pairs:enjs:format
  :~  ['token' %s token]
      ['state' %s state]
      ['kind' %s kind]
      ['category' %s state.row]
      ['at' %s (scot %da at.row)]
      ['source' %s kind.row]
      ['id' %s id.row]
  ==
++  decode
  |=  [token=@t state=@t kind=@t raw=@t]
  ^-  (unit position)
  ?.  (lte (met 3 raw) 4.096)  ~
  %-  mole
  |.
  =/  value  (need (de:json:html raw))
  ?>  ?&  =((string:j value 'token') token)
          =((string:j value 'state') state)
          =((string:j value 'kind') kind)
      ==
  =/  label  (string:j value 'category')
  =/  source  (string:j value 'source')
  ?>  %+  lien
        `(list @t)`~['uncertain' 'blocked' 'approval' 'running' 'waiting' 'finished']
      |=(s=@t =(s label))
  ?>  %+  lien
        `(list @t)`~['task' 'proposal' 'input' 'schedule' 'notes']
      |=(s=@t =(s source))
  [;;(category label) (slav %da (string:j value 'at')) ;;(source-kind source) (string:j value 'id')]
++  project-title
  |=  [db=state:w id=@t]
  ^-  @t
  =/  project  (~(get by projects.db) id)
  ?~(project id title.u.project)
++  clipped
  |=  text=@t
  ^-  @t
  (make-snippet:snippets ~[text])
++  row-json
  |=  [row=position db=state:w hands=state:hh jobs=(map @uv schedule:cr) native=state:hn]
  ^-  json
  =/  common=(list [@t json])
    :~  ['kind' %s kind.row]
        ['id' %s id.row]
        ['state' %s state.row]
        ['at' ?:(=(0 at.row) ~ (stamp:j at.row))]
    ==
  =/  fields=(list [@t json])
    ?-  kind.row
        %task
      =/  task  (~(got by tasks.db) id.row)
      :~  ['title' %s title.task]
          ['detail' %s (clipped ?:(=('' outcome.task) description.task outcome.task))]
          ['status' %s status.task]
          ['project' ?:(=('' project.task) ~ [%s project.task])]
          ['projectTitle' %s (project-title db project.task)]
          ['artifact' (nullable:j artifact.task)]
          ['claimant' ?~(claimant.task ~ (actor-json:j u.claimant.task))]
          ['version' (numb:enjs:format version.task)]
      ==
        %proposal
      =/  proposal  (~(got by proposals.db) id.row)
      =/  artifact  (~(get by artifacts.db) artifact.proposal)
      :~  ['title' %s title.value.proposal]
          ['detail' %s (clipped ?:(=(%pending status.proposal) reason.proposal decision.proposal))]
          ['status' %s status.proposal]
          ['artifact' %s artifact.proposal]
          ['project' ?~(artifact ~ (nullable:j project.u.artifact))]
          ['by' (actor-json:j by.proposal)]
          ['base' (numb:enjs:format base.proposal)]
          ['revision' ?~(revision.proposal ~ (numb:enjs:format u.revision.proposal))]
      ==
      %input  (input-fields hands (slav %uv id.row))
        %schedule
      =/  job  (~(got by jobs) (slav %uv id.row))
      :~  ['title' %s (clipped prompt.job)]
          ['detail' %s (clipped reason.job)]
          ['status' %s state.job]
          ['scheduleKind' %s kind.job]
          ['sessionId' %s sid.job]
          ['runSessionId' %s run-sid.job]
          ['hand' %s hand.job]
          ['destination' %s destination.job]
          ['schedule' %s expression.job]
          ['next' %s (scot %da next.job)]
          ['remaining' (numb:enjs:format remaining.job)]
          ['lastInput' ?~(last.job ~ [%s (scot %uv u.last.job)])]
      ==
        %notes
      =/  pending  (need pending.native)
      :~  ['title' %s title.value.pending]
          ['artifact' %s artifact.pending]
          ['action' %s action.pending]
          ['sent' %b sent.pending]
          ['uncertain' %b uncertain.pending]
      ==
    ==
  (pairs:enjs:format (weld common fields))
++  input-fields
  |=  [hands=state:hh id=@uv]
  ^-  (list [@t json])
  =/  observation  (~(got by observations.hands) id)
  =/  publication  (~(get by outbox.hands) id)
  =/  control  (~(get by controls.hands) id)
  =/  binding  (~(get by bindings.hands) binding.observation)
  ::  A publication retains its destination even if the binding changes.
  =/  destination=[session=(unit @t) hand=@t address=@t]
    ?^  publication
      [`sid.u.publication hand.u.publication address.u.publication]
    ?~  binding  [~ '' '']
    [`sid.u.binding hand.u.binding address.u.binding]
  :~  ['title' %s (clipped text.observation)]
      ['detail' %s ?~(publication '' (clipped body.u.publication))]
      ['execution' %s phase.observation]
      ['delivery' ?~(publication ~ [%s status.u.publication])]
      ['sessionId' (nullable:j session.destination)]
      ['binding' %s binding.observation]
      ['hand' %s hand.destination]
      ['destination' %s address.destination]
      ['actor' %s actor.observation]
      ['attempt' (numb:enjs:format ?~(control 0 attempt.u.control))]
      ['externalId' %s ?~(publication '' (clipped external.u.publication))]
      ['bindingEnabled' %b ?~(binding | enabled.u.binding)]
  ==
::
++  read
  |=  $:  db=state:w
          hands=state:hh
          jobs=(map @uv schedule:cr)
          native=state:hn
          args=json
          now=@da
      ==
  ^-  (each json @t)
  =/  state  (fall (optional:j args 'state') 'attention')
  =/  kind  (fall (optional:j args 'kind') 'all')
  =/  limit  (number:j args 'limit' 24)
  ?.  ?&  (gth limit 0)
          (lte limit 32)
          %+  lien
            ^-  (list @t)
            ~['all' 'attention' 'uncertain' 'blocked' 'approval' 'running' 'waiting' 'finished']
          |=(label=@t =(label state))
          %+  lien  `(list @t)`~['all' 'task' 'proposal' 'input' 'schedule' 'notes']
          |=(source=@t =(source kind))
      ==
    [%| 'Choose a valid inbox state and source, with 1–32 records per page.']
  =/  token  (fence db hands jobs native)
  =/  cursor  (optional:j args 'cursor')
  =/  after  ?~(cursor ~ (decode token state kind u.cursor))
  ?:  &(?=(^ cursor) ?=(~ after))
    [%| 'Work changed or the page is no longer valid. Refresh the inbox from the first page.']
  =/  out=selection  *selection
  =/  =filter  [state kind after limit]
  =.  out  (collect-tasks db filter out)
  =.  out  (collect-proposals db filter out)
  =.  out  (collect-inputs hands filter out)
  =.  out  (collect-schedules jobs filter out)
  =?  out  ?=(^ pending.native)
    =/  pending  u.pending.native
    %:  select
      [?:(uncertain.pending %uncertain %waiting) `@da`0 %notes (scot %uv id.pending)]
      out
      state
      kind
      after
      +(limit)
    ==
  =/  selected  (scag limit rows.out)
  =/  counts
    %+  turn  ~(tap by counts.out)
    |=  [state=category count=@ud]
    [state (numb:enjs:format count)]
  :-  %&
  %-  pairs:enjs:format
  :~  ['items' %a (turn selected |=(row=position (row-json row db hands jobs native)))]
      ['counts' (pairs:enjs:format counts)]
      ['cursor' ?:((lte (lent rows.out) limit) ~ [%s (encode token state kind (rear selected))])]
      ['observedAt' (stamp:j now)]
      ['referenceOnly' %b &]
  ==
::
++  collect-tasks
  |=  [db=state:w filter=filter out=selection]
  ^-  selection
  =+  filter
  =/  rest  ~(tap by tasks.db)
  |-  ^-  selection
      ?~  rest  out
      =/  [id=@t task=task:w]  i.rest
      =.  out  (select [(task-state task) updated.task %task id] out state kind after +(limit))
      $(rest t.rest)
::
++  collect-proposals
  |=  [db=state:w filter=filter out=selection]
  ^-  selection
  =+  filter
  =/  rest  ~(tap by proposals.db)
  |-  ^-  selection
      ?~  rest  out
      =/  [id=@t proposal=proposal:w]  i.rest
      =/  row=position
        :*  ?:(=(%pending status.proposal) %approval %finished)
            (fall decided.proposal at.proposal)
            %proposal
            id
        ==
      =.  out  (select row out state kind after +(limit))
      $(rest t.rest)
::
++  collect-inputs
  |=  [hands=state:hh filter=filter out=selection]
  ^-  selection
  =+  filter
  =/  rest  ~(tap by observations.hands)
  |-  ^-  selection
      ?~  rest  out
      =/  [id=@uv observation=observation:hh]  i.rest
      =/  publication  (~(get by outbox.hands) id)
      =/  control  (~(get by controls.hands) id)
      =/  status  (input-state phase.observation ?~(publication ~ `status.u.publication))
      =/  row=position
        [status (input-time at.observation publication control) %input (scot %uv id)]
      =.  out  (select row out state kind after +(limit))
      $(rest t.rest)
::
++  collect-schedules
  |=  [jobs=(map @uv schedule:cr) filter=filter out=selection]
  ^-  selection
  =+  filter
  =/  rest  ~(tap by jobs)
  |-  ^-  selection
      ?~  rest  out
      =/  [id=@uv job=schedule:cr]  i.rest
      ::  A schedule is a plan, not its latest execution. Its admitted runs
      ::  appear as input records with their separate publication receipts.
      =/  status=category
        ?:  =(%paused state.job)  %blocked
        ?:  =(%active state.job)  %waiting
        %finished
      =.  out  (select [status `@da`0 %schedule (scot %uv id)] out state kind after +(limit))
      $(rest t.rest)
--

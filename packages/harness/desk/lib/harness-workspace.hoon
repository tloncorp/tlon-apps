::  Pure work-record transitions. No provider, Gall, timer, delivery or session
::  store dependency. The head supplies live authority and persists the result.
/-  w=harness-workspace
|%
::
++  project-role
  |=  [db=state:w who=authority:w id=id:w]
  ^-  (unit role:w)
  =/  project  (~(get by projects.db) id)
  ?~  project  ~
  ?:  archived.u.project  ~
  ?:  owner.who  `%contributor
  ?:  =(0 access.who)  ~
  (~(get by members.u.project) access.who)
::
++  can-contribute
  |=  [db=state:w who=authority:w id=id:w]
  ^-  ?
  =/  role  (project-role db who id)
  ?~  role  |
  ?=(?(%contributor %maintainer) u.role)
::
++  can-maintain
  |=  [db=state:w who=authority:w id=id:w]
  ^-  ?
  =(`%maintainer (project-role db who id))
::
++  can-read
  |=  [db=state:w who=authority:w artifact=artifact:w]
  ^-  ?
  ?:  owner.who  &
  ?:  archived.artifact  |
  ?~  project.artifact  &(!=(0 access.who) =(owner.artifact access.who))
  ?=(^ (project-role db who u.project.artifact))
::
++  can-propose
  |=  [db=state:w who=authority:w artifact=artifact:w]
  ^-  ?
  ?:  archived.artifact  |
  ?:  owner.who  &
  ?~  project.artifact  &(!=(0 access.who) =(owner.artifact access.who))
  (can-contribute db who u.project.artifact)
::
++  content-size
  |=  value=content:w
  ^-  @ud
  %+  add  (add (met 3 title.value) (met 3 body.value))
  %+  roll  sources.value
  |=  [source=source:w bytes=@ud]
  (add bytes (add (met 3 label.source) (met 3 url.source)))
::
++  valid-content
  |=  value=content:w
  ^-  ?
  ?&  (gth (met 3 title.value) 0)
      (lte (met 3 title.value) 256)
      (lte (met 3 body.value) 262.144)
      (lte (lent sources.value) 16)
      %+  levy  sources.value
      |=  source=source:w
      &((lte (met 3 label.source) 256) (lte (met 3 url.source) 2.048))
  ==
::
++  can-add-content
  |=  [db=state:w value=content:w]
  &((valid-content value) (lte (add bytes.db (content-size value)) 67.108.864))
::
++  valid-id
  |=  id=@t
  ^-  ?
  ?&  (gth (met 3 id) 0)
      (lte (met 3 id) 96)
      %+  levy  (trip id)
      |=  char=@t
      ?|  &((gte char 'a') (lte char 'z'))
          &((gte char '0') (lte char '9'))
          =(char '-')
      ==
  ==
::
++  valid-slug
  |=  slug=@t
  ^-  ?
  ?&  (valid-id slug)
      (lte (met 3 slug) 80)
      !=('-' (end [3 1] slug))
      !=('-' (rsh [3 (dec (met 3 slug))] slug))
  ==
::
++  touch
  |=  [db=state:w key=record-key:w now=@da]
  ^-  state:w
  =/  prior  (fall (~(get by recency.db) key) 0)
  db(recency (~(put by recency.db) key (max now prior)))
::
++  record
  |=  [db=state:w who=authority:w action=@t target=id:w now=@da]
  ^-  state:w
  ::  Keep recent operational evidence bounded without ever exhausting the
  ::  ability to revoke access or unpublish. Accepted revisions stay immutable.
  =?  db  (lien `(list @t)`~['project-create' 'project-edit' 'member'] |=(name=@t =(action name)))
    (touch db [%project target] now)
  =?  db
    %+  lien
      ^-  (list @t)
      :~  'artifact-create'  'artifact-save'  'artifact-archive'  'artifact-rename'  'publish'
          'unpublish'
      ==
    |=(name=@t =(action name))
    (touch db [%artifact target] now)
  =?  db  |(=('propose' action) =('review' action))
    =/  proposal  (~(get by proposals.db) target)
    ?~(proposal db (touch db [%artifact artifact.u.proposal] now))
  %=  db
    writes  +(writes.db)
    history  [[now by.who action target] (scag 2.047 history.db)]
  ==
::
++  revise
  |=  [artifact=artifact:w value=content:w who=authority:w now=@da]
  ^-  artifact:w
  %=  artifact
    head  +(head.artifact)
    label  title.value
    revisions  (~(put by revisions.artifact) +(head.artifact) [now by.who value])
  ==
::
++  apply
  |=  [db=state:w who=authority:w action=action:w now=@da]
  ^-  (each state:w @t)
  ?.  (valid-id id.action)  [%| 'Invalid work record ID']
  =/  changed  (transition db who action now)
  ?:  ?=(%| -.changed)  changed
  ::  Every accepted mutation advances the write sequence and audit history.
  [%& (record p.changed who (scot %tas -.action) id.action now)]
::
++  transition
  |=  [db=state:w who=authority:w action=action:w now=@da]
  ^-  (each state:w @t)
  ?-  -.action
    %project-create  (project-create db who action now)
    ?(%project-edit %member)  (project-update db who action now)
    %artifact-create  (artifact-create db who action now)
    %propose  (propose db who action now)
    %review  (review db who action now)
    ?(%artifact-save %artifact-archive %publish %unpublish)  (artifact-update db who action now)
    %task-create  (task-create db who action now)
    ?(%task-claim %task-assign %task-update %task-delete)  (task-update db who action now)
  ==
::
++  project-create
  |=  [db=state:w who=authority:w action=action:w now=@da]
  ^-  (each state:w @t)
  ?>  ?=(%project-create -.action)
  ?.  |(owner.who !=(0 access.who))  [%| 'An agent with the workspace tool is required']
  ?:  (~(has by projects.db) id.action)  [%| 'Project ID already exists']
  ?.  ?&  (gth (met 3 title.action) 0)
          (lte (met 3 title.action) 256)
          (lte (met 3 description.action) 4.096)
          (lth ~(wyt by projects.db) 128)
      ==
    [%| 'Project title, description or capacity limit exceeded']
  [%& db(projects (~(put by projects.db) id.action [title.action description.action 1 ~ |]))]
::
::  Project membership and archival remain owner decisions. Maintainers
::  can edit the details of projects to which they still have access.
++  project-update
  |=  [db=state:w who=authority:w action=action:w now=@da]
  ^-  (each state:w @t)
  ?>  ?=(?(%project-edit %member) -.action)
  =/  project  (~(get by projects.db) id.action)
  ?~  project  [%| 'Project not found']
  =/  permitted
    ?:  owner.who  &
    ?:  ?=(%member -.action)  |
    &((can-maintain db who id.action) =(archived.action archived.u.project))
  ?.  permitted
    :*  %|
        'Only the owner can change access or archive projects; current maintainers can edit project details'
    ==
  ?.  =(version.action version.u.project)  [%| 'Project changed; reload before saving']
  =/  next=project:w
    ?:  ?=(%member -.action)
      %=  u.project
        version  +(version.u.project)
        members  ?~  role.action
                   (~(del by members.u.project) scope.action)
                 (~(put by members.u.project) scope.action u.role.action)
      ==
    %=  u.project
      title  title.action
      description  description.action
      archived  archived.action
      version  +(version.u.project)
    ==
  ?.  ?&  (gth (met 3 title.next) 0)
          (lte (met 3 title.next) 256)
          (lte (met 3 description.next) 4.096)
          (lte ~(wyt by members.next) 64)
      ==
    [%| 'Project title, description or membership limit exceeded']
  [%& db(projects (~(put by projects.db) id.action next))]
::
++  artifact-create
  |=  [db=state:w who=authority:w action=action:w now=@da]
  ^-  (each state:w @t)
  ?>  ?=(%artifact-create -.action)
  ?:  (~(has by artifacts.db) id.action)  [%| 'Artifact ID already exists']
  ?.  (lth ~(wyt by artifacts.db) 512)  [%| 'Artifact capacity reached']
  ?.  (can-add-content db value.action)
    [%| 'Document or retained-content capacity limit exceeded']
  ?.  ?~(project.action |(owner.who !=(0 access.who)) (can-contribute db who u.project.action))
    [%| 'No contributor access to this project']
  =/  =artifact:w  [access.who project.action title.value.action 0 ~ ~ 0 |]
  =.  bytes.db  (add bytes.db (content-size value.action))
  ?:  owner.who
    :-  %&
    db(artifacts (~(put by artifacts.db) id.action (revise artifact value.action who now)))
  ::  New agent-authored documents start as a reviewable proposal, not as
  ::  already accepted project knowledge. The artifact itself has identity.
  ?:  (~(has by proposals.db) id.action)  [%| 'Proposal ID already exists']
  ?.  (lth ~(wyt by proposals.db) 2.048)  [%| 'Proposal capacity reached']
  =/  =proposal:w  [id.action 0 by.who access.who now value.action 'New document' %pending ~ '' ~]
  :-  %&
  %=  db
    artifacts  (~(put by artifacts.db) id.action artifact)
    proposals  (~(put by proposals.db) id.action proposal)
  ==
::
++  propose
  |=  [db=state:w who=authority:w action=action:w now=@da]
  ^-  (each state:w @t)
  ?>  ?=(%propose -.action)
  ?:  (~(has by proposals.db) id.action)  [%| 'Proposal ID already exists']
  =/  artifact  (~(get by artifacts.db) artifact.action)
  ?~  artifact  [%| 'Artifact not found or unavailable']
  ?.  (can-propose db who u.artifact)  [%| 'No contributor access to this artifact']
  ?.  =(base.action head.u.artifact)
    [%| 'Artifact changed; read the current revision before proposing']
  ?.  &((can-add-content db value.action) (lte (met 3 reason.action) 4.096))
    [%| 'Proposal content limit exceeded']
  ?.  (lth ~(wyt by proposals.db) 2.048)  [%| 'Proposal capacity reached']
  =/  next=proposal:w
    [artifact.action base.action by.who access.who now value.action reason.action %pending ~ '' ~]
  :-  %&
  %=  db
    proposals  (~(put by proposals.db) id.action next)
    bytes  (add bytes.db (content-size value.action))
  ==
::
++  review
  |=  [db=state:w who=authority:w action=action:w now=@da]
  ^-  (each state:w @t)
  ?>  ?=(%review -.action)
  ?.  owner.who  [%| 'Only the owner can accept or reject a proposal']
  =/  proposal  (~(get by proposals.db) id.action)
  ?~  proposal  [%| 'Proposal not found']
  ?.  =(%pending status.u.proposal)  [%| 'Proposal was already reviewed']
  ?.  (lte (met 3 reason.action) 4.096)  [%| 'Review note exceeds limit']
  =/  next
    %=  u.proposal
      status  ?:(accept.action %accepted %rejected)
      decided  `now
      decision  reason.action
    ==
  ?.  accept.action  [%& db(proposals (~(put by proposals.db) id.action next))]
  =/  artifact  (~(get by artifacts.db) artifact.u.proposal)
  ?~  artifact  [%| 'Artifact no longer exists']
  ?.  =(base.u.proposal head.u.artifact)
    [%| 'Proposal is stale; it cannot overwrite a newer revision']
  =/  author=authority:w  [=(0 access.u.proposal) by.u.proposal access.u.proposal]
  ?.  (can-propose db author u.artifact)  [%| 'Proposal author no longer has contributor access']
  ?.  (lth head.u.artifact 256)  [%| 'Artifact revision capacity reached']
  =/  revised  (revise u.artifact value.u.proposal author now)
  ::  Proposal and revision share the same immutable content noun.
  :-  %&
  %=  db
    artifacts  (~(put by artifacts.db) artifact.u.proposal revised)
    proposals  (~(put by proposals.db) id.action next(revision `head.revised))
  ==
::  Accepted content and its public exposure advance independently. A
::  content edit never silently republishes a document.
::
++  artifact-update
  |=  [db=state:w who=authority:w action=action:w now=@da]
  ^-  (each state:w @t)
  ?>  ?=(?(%artifact-save %artifact-archive %publish %unpublish) -.action)
  ?.  owner.who  [%| 'Only the owner can save accepted revisions or change publication']
  =/  artifact  (~(get by artifacts.db) id.action)
  ?~  artifact  [%| 'Artifact not found']
  ?:  ?=(%artifact-save -.action)
    ?.  =(base.action head.u.artifact)
      [%| 'Artifact changed; your draft was not overwritten. Reload the current revision']
    ?:  archived.u.artifact  [%| 'Restore the artifact before editing']
    ?.  =(project.action project.u.artifact)
      [%| 'Project scope is fixed; copy the selected revision into a new artifact to share it']
    ?.  ?~(project.action & ?=(^ (project-role db who u.project.action)))
      [%| 'Project not found or archived']
    ?.  &((can-add-content db value.action) (lth head.u.artifact 256))
      [%| 'Document, revision or retained-content capacity limit exceeded']
    =/  revised  (revise u.artifact(project project.action) value.action who now)
    :-  %&
    %=  db
      artifacts  (~(put by artifacts.db) id.action revised)
      bytes  (add bytes.db (content-size value.action))
    ==
  ?:  ?=(%artifact-archive -.action)
    ?.  =(base.action head.u.artifact)  [%| 'Artifact changed; reload before archiving']
    ?:  ?=(^ publication.u.artifact)  [%| 'Unpublish the artifact before archiving']
    [%& db(artifacts (~(put by artifacts.db) id.action u.artifact(archived archived.action)))]
  =/  expected
    ?-  -.action
      %publish  exposure.action
      %unpublish  exposure.action
    ==
  ?.  =(expected exposure.u.artifact)  [%| 'Publication changed; inspect its current state']
  =/  slugs
    ?~(publication.u.artifact slugs.db (~(del by slugs.db) slug.u.publication.u.artifact))
  ?:  ?=(%unpublish -.action)
    :-  %&
    %=  db
      slugs  slugs
      artifacts
        %+  ~(put by artifacts.db)
          id.action
        u.artifact(publication ~, exposure +(exposure.u.artifact))
    ==
  ?:  archived.u.artifact  [%| 'Restore the artifact before publishing']
  ?.  =(head.action head.u.artifact)  [%| 'Artifact changed; preview the publication again']
  ?.  (~(has by revisions.u.artifact) revision.action)
    [%| 'Only accepted revisions can be published']
  ?.  (valid-slug slug.action)
    :*  %|
        'Public slug must use lowercase letters, digits and interior hyphens, up to 80 characters'
    ==
  ?:  (~(has by slugs) slug.action)  [%| 'This public URL belongs to another artifact']
  ?.  (lte (met 3 html.action) 2.097.152)  [%| 'Rendered page exceeds publication limit']
  =/  next
    %=  u.artifact
      publication  `[revision.action slug.action html.action now]
      exposure  +(exposure.u.artifact)
    ==
  :-  %&
  %=  db
    slugs  (~(put by slugs) slug.action id.action)
    artifacts  (~(put by artifacts.db) id.action next)
  ==
::  Tasks coordinate work without granting access to documents or tools.
::
++  task-create
  |=  [db=state:w who=authority:w action=action:w now=@da]
  ^-  (each state:w @t)
  ?>  ?=(%task-create -.action)
  ?.  |(owner.who !=(0 access.who))  [%| 'An agent with the workspace tool is required']
  =/  project  (~(get by projects.db) project.action)
  ?.  |(=('' project.action) ?~(project | !archived.u.project))  [%| 'Project is unavailable']
  ?:  (~(has by tasks.db) id.action)  [%| 'Task ID already exists']
  ?.  ?&  (gth (met 3 title.action) 0)
          (lte (met 3 title.action) 256)
          (lte (met 3 description.action) 4.096)
          (lth ~(wyt by tasks.db) 2.048)
      ==
    [%| 'Task title, description or capacity limit exceeded']
  ::  Seed from the durable write sequence so deleting and recreating an ID
  ::  cannot revive an earlier version token. Other records do not change it.
  =/  =task:w
    [project.action title.action description.action +(writes.db) %open ~ '' ~ now]
  [%& db(tasks (~(put by tasks.db) id.action task))]
::
++  task-update
  |=  [db=state:w who=authority:w action=action:w now=@da]
  ^-  (each state:w @t)
  ?>  ?=(?(%task-claim %task-assign %task-update %task-delete) -.action)
  =/  task  (~(get by tasks.db) id.action)
  ?~  task  [%| 'Task not found or unavailable']
  ?.  |(owner.who !=(0 access.who))  [%| 'An agent with the workspace tool is required']
  =/  expected
    ?-  -.action
      %task-claim  version.action
      %task-assign  version.action
      %task-update  version.action
      %task-delete  version.action
    ==
  ?.  =(expected version.u.task)  [%| 'Task changed; read it again before updating']
  ?:  ?=(%task-delete -.action)
    :-  %&
    %=  db
      tasks  (~(del by tasks.db) id.action)
      writes  (max writes.db version.u.task)
    ==
  ?:  ?=(%task-assign -.action)
    =/  next
      %=  u.task
        version  +(version.u.task)
        claimant  assignee.action
        updated  now
      ==
    [%& db(tasks (~(put by tasks.db) id.action next))]
  ?:  ?=(%task-claim -.action)
    ?.  &(=(%open status.u.task) ?=(~ claimant.u.task))  [%| 'Task is already assigned or not open']
    =/  next
      %=  u.task
        version  +(version.u.task)
        status  %claimed
        claimant  `by.who
        updated  now
      ==
    [%& db(tasks (~(put by tasks.db) id.action next))]
  ?.  (lte (met 3 outcome.action) 4.096)  [%| 'Task outcome exceeds limit']
  =/  linked  ?~(artifact.action ~ (~(get by artifacts.db) u.artifact.action))
  ?.  ?|  =(artifact.action artifact.u.task)
          ?~(artifact.action & &(?=(^ linked) (can-read db who u.linked)))
      ==
    [%| 'Task result document must be accessible to this agent']
  =/  edited  u.task
  =?  edited  ?=(^ details.action)
    %=  edited
      title  title.u.details.action
      description  description.u.details.action
      project  project.u.details.action
    ==
  ?.  ?&  (gth (met 3 title.edited) 0)
          (lte (met 3 title.edited) 256)
          (lte (met 3 description.edited) 4.096)
      ==
    [%| 'Task title or description exceeds limits']
  =/  group  (~(get by projects.db) project.edited)
  ?.  |(=(project.edited project.u.task) =('' project.edited) ?~(group | !archived.u.group))
    [%| 'Project is unavailable']
  =/  next
    %=  edited
      version  +(version.u.task)
      status  status.action
      claimant
        ?:  =(status.action status.u.task)  claimant.u.task
        ?:  =(%open status.action)  ~
        ?~(claimant.u.task `by.who claimant.u.task)
      outcome  outcome.action
      artifact  artifact.action
      updated  now
    ==
  [%& db(tasks (~(put by tasks.db) id.action next))]
--

::  harness: types for the head of an on-ship agent harness
::
::    the session log is the state: a closed vocabulary of events,
::    replayed into a view, from which a decider plans the next step.
::    provider codecs translate their wire formats into these nouns.
::
/-  l=harness-lcm
|%
+$  session-id  @t
+$  request-kind  ?(%turn %compaction %memory)
+$  stop-reason  ?(%stop %tool-calls %length %error)
::  Meaning of a settled turn, independent of the recipient's wire format.
+$  outcome
  $%  [%reply body=@t]
      [%failure reason=@t]
      [%cancelled reason=@t]
  ==
+$  tool-call  [id=@t name=@t args=@t]
::  Plain families retain their noun shape. MCP authority names one server;
::  the old bare %mcp atom stays readable in history, but grants no access.
+$  tool-grant  $@(term $%([%mcp server=@t] [%clay prefix=path]))
+$  search-provider  ?(%brave %searxng)
+$  search-config  [provider=search-provider instance-url=@t]
+$  search-requests  (map [session-id @t] search-provider)
+$  usage  [prompt=@ud completion=@ud]
::  A checkpoint replaces exactly this prefix of the active context. The
::  event-log boundary and digest make its sources recoverable without copying
::  them into a second store. Command identity is absent for automatic work.
+$  compaction-plan
  $:  through=@ud
      count=@ud
      length=@ud
      source=@uvH
      input=@ud
      output=@ud
      url=@t
      model=@t
      command=(unit input-id)
  ==
+$  lcm-plan
  $:  checkpoint=compaction-plan
      sources=(list @ud)
      children=(list @ud)
  ==
+$  summary-models  [compaction=(unit config) lcm=(unit config)]
::  conversation items, independent of any provider's JSON representation
::
+$  item
  $%  [%user body=@t]
      [%assistant body=@t calls=(list tool-call)]
      [%tool call-id=@t name=@t body=@t]
      ::  Provider continuation with reasoning/signatures; not a transcript.
      [%reasoning url=@t model=@t data=@t]
  ==
::  config is data; capabilities absent by default (tools=~)
::
+$  config
  $:  zdr=$~(| ?)       ::  require OpenRouter zero-data-retention routing
      fallbacks=(list model-choice)
      url=@t              ::  inference endpoint
      model=@t
      key=@t              ::  ingress-only; blanked before the config event
      headers=(list [name=@t value=@t])
      system=@t
      max-context=@ud     ::  provider window (catalog or fallback)
      tools=(list tool-grant)
  ==
+$  model-choice  [provider=@t model=@t]
+$  model-contexts  (map @t [identity=@uvH windows=(map @t @ud)])
::  Remote, stateless Streamable HTTP MCP server. Headers are held in
::  agent state and copied only onto requests to this exact endpoint.
::
+$  mcp-server-id  @t
+$  mcp-server
  $:  name=@t
      url=@t
      headers=(list [name=@t value=@t])
      enabled=?
  ==
::  a self-scheduled wakeup: when it fires, prompt enters the session
::
+$  timer  [at=@da every=(unit @dr) prompt=@t]
::  a skill: agent-level knowledge, stored in state (not the desk).
::  the catalog (names + descs) is injected into context when the
::  %skills family is granted; bodies are read on demand
::
+$  skill  [desc=@t body=@t]
::  agent-to-agent over ames: peer-as-tool. identity-based grants;
::  asks land in a durable sandboxed session per peer. the answer
::  crosses the wire; the data doesn't
::
+$  ask-id  @uv
+$  peer-grant
  $:  tools=(list tool-grant)     ::  ~ for strangers
      model=(unit @t)       ::  override; cheap model for low-trust
      budget=@ud            ::  lifetime token cap for their session; 0 = no cap
      inflows=(set @t)      ::  skill names their session may see
  ==
::  the wire protocol: mark %harness-a2a-0, typed and growable
::
+$  a2a
  $%  [%ask id=ask-id kind=%text prompt=@t]
      [%answer id=ask-id result=(each @t @t)]
  ==
::  Separate, versioned discovery mark; older ask/answer peers stay compatible.
+$  peer-access-message
  $%  [%query id=ask-id]
      [%status id=(unit ask-id) grant=(unit peer-grant)]
  ==
+$  peer-access  [grant=(unit peer-grant) checked=@da]
+$  admin-result  [connection=@t payload=@t]
+$  peer-rpc
  $%  [%tools id=ask-id query=@t]
      [%invoke id=ask-id issued=@da name=@t args=@t]
      [%result id=ask-id result=(each @t @t)]
  ==
+$  peer-receipt
  [issued=@da name=@t args=@t sid=session-id result=(unit (each @t @t))]
+$  local-mcp-progress
  [generation=@ud server=mcp-server-id fingerprint=@uv status=@ud body=@t]
::  Every admitted input says where it came from and where a response belongs.
::  %input-admitted remains readable so existing session logs still replay.
::
+$  input-id  @uv
+$  input-source
  $%  [%acp client=@t]
      [%poke =ship]
      [%timer name=@ta]
      [%webhook path=@t]
      [%peer =ship ask=ask-id]
      [%subagent parent=session-id call-id=@t]
      [%rehearsal parent=session-id call-id=@t skill=@t]
      [%work request=@uv]
      [%hand binding=@t hand=@t address=@t event=@t actor=@t]
  ==
+$  reply-target
  $%  [%acp client=@t]
      [%http id=@ta]
      [%peer =ship ask=ask-id]
      [%session sid=session-id call-id=@t]
      [%hand binding=@t]
  ==
+$  admitted-input
  $:  id=input-id
      source=input-source
      actor=(unit @p)
      reply=(unit reply-target)
      at=@da
      =item
  ==
::  the closed event vocabulary
::
+$  event
  $%  [%config-replaced =config]
      [%input-admitted =item]
      [%input-received input=admitted-input]
      ::  Bounded source material captured at admission, never a human command.
      [%context-received input-id=input-id body=@t]
      ::  Local command reply, linked to its admitted input; not inference.
      [%command-completed input-id=input-id name=@t body=@t]
      ::  Explicit conversation notes, independent of generated checkpoints.
      ::  A null body unpins a note; the audit history is not erased.
      [%memory-set name=@t body=(unit @t)]
      [%llm-requested req=@ud kind=request-kind]
      [%llm-routed req=@ud =config]
      [%llm-completed req=@ud stop=stop-reason =usage =item]
      [%llm-reasoning req=@ud url=@t model=@t data=@t]
      [%llm-failed req=@ud err=@t]
      [%tool-requested call-id=@t name=@t]
      [%tool-requested-2 generation=@ud call-id=@t name=@t]
      [%tool-completed call-id=@t name=@t body=@t]
      [%compaction-completed req=@ud summary=@t]
      [%compaction-planned req=@ud plan=compaction-plan]
      [%lcm-planned req=@ud plan=lcm-plan]
      [%checkpoint-completed req=@ud summary=@t =usage reply=(unit [input-id=input-id body=@t])]
      [%compaction-failed req=@ud err=@t =usage]
      [%cancelled req=(unit @ud) calls=(set @t) reason=@t]
      [%forked from=session-id at=@ud req=(unit @ud) calls=(set @t)]
      [%retried ~]
      [%halted reason=@t]
  ==
::  a session: the log is the state, newest event first
::
+$  session  [log=(list event) next-req=@ud]
::  derived view, a fold over the log
::
+$  view
  $:  =config
      route=(unit [req=@ud =config])
      summary=(unit @t)
      items=(list item)
      pending=(unit [req=@ud kind=request-kind])
      wait=(set @t)                    ::  async tool calls in flight
      total=usage
      err=(unit @t)
      cancelled=(unit @t)             ::  stopped until new input or retry
      origin=(unit [from=session-id at=@ud])
      compaction=(unit compaction-plan)
      compact-usage=usage
      compact-attempts=@ud
      memory=(map @t @t)              ::  bounded shared reference for this request
      revision=@ud
      positions=(list @ud)            ::  event address parallel to each item
      lcm=forest:l
      lcm-plan=(unit lcm-plan)
  ==
::  the decider's output
::
+$  step
  $%  [%turn ~]
      [%compact ~]
      [%tools calls=(list tool-call)]
      [%halt reason=@t]
  ==
::  pokes
::
+$  action
  $%  [%new sid=session-id =config js-timeout=@dr]
      [%send sid=session-id text=@t]
      [%fork from=session-id to=session-id]
      [%fork-at from=session-id to=session-id at=@ud]
      [%compact sid=session-id]
      [%cancel sid=session-id]
      [%fence sid=session-id]
      [%delete sid=session-id]
      [%retry sid=session-id]
      [%config sid=session-id =config js-timeout=@dr]
      [%timer-set sid=session-id name=@ta in=@dr every=(unit @dr) prompt=@t]
      [%timer-cancel sid=session-id name=@ta]
      [%skill-add name=@t desc=@t body=@t]
      [%skill-del name=@t]
      [%set-key key=@t]
      ::  governance: a human can promote or drop a proposed skill
      ::
      [%commit-skill name=@t]
      [%discard-skill name=@t]
      [%grant =ship grant=peer-grant]
      [%revoke =ship]
      [%peer-config =config]
      [%defaults =config]
      [%mcp-config servers=(list [id=mcp-server-id server=mcp-server])]
      ::  internal: session spawning, sent by the agent to itself
      ::
      [%spawn parent=session-id call-id=@t prompt=@t system=(unit @t)]
      ::  internal: an ask_peer tool call, sent by the agent to itself
      ::
      [%ask-peer sid=session-id call-id=@t =ship prompt=@t]
      [%check-peer sid=session-id call-id=@t =ship]
      [%peer-refresh ~]
      [%admin-call sid=session-id call-id=@t method=@t params=json]
      [%local-mcp sid=session-id call-id=@t]
      [%peer-rpc sid=session-id call-id=@t =ship name=(unit @t) args=@t]
      ::  internal: a run_js tool call, sent by the agent to itself
      ::
      [%run-js sid=session-id call-id=@t code=@t]
      ::  internal: a rehearse_skill tool call — spawn a rehearsal child
      ::  session that sees the staged skill, to test it before committing
      ::
      [%rehearse sid=session-id call-id=@t name=@t input=@t]
  ==
::  Generation-fenced internal dispatch. Legacy action pokes remain readable.
+$  effect  [generation=@ud act=action]
::  facts
::
+$  update
  $%  [%event sid=session-id =event]
  ==
--

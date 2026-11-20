::  Optional Tlon presentation of authenticated work receipts. Buttons send
::  ordinary commands; neither this projection nor a client selection approves.
/-  h=harness, wc=harness-work-control, w=harness-workspace
/+  control=harness-work-control, j=harness-workspace-json,
    view=harness-work-view, cmd=harness-command,
    help=harness-work-help, copy=harness-work-copy
|%
++  has-command-result
  |=  [input=@uv text=@t log=(list event:h)]
  ^-  ?
  %+  lien  (scag 64 log)
  |=  event=event:h
  ?&  ?=(%command-completed -.event)
      =('work' name.event)
      =(input input-id.event)
      =(text body.event)
  ==
++  browse
  |=  [db=state:w who=authority:w input=@uv prompt=@t text=@t log=(list event:h)]
  ^-  (unit @t)
  ::  Only a matching head command result can produce a navigation card.
  ?.  (has-command-result input text log)  ~
  =/  outer  (parse:cmd prompt)
  ?.  &(?=(^ outer) =('work' name.u.outer))  ~
  =/  parsed  (parse:cmd (cat 3 '/' arg.u.outer))
  =/  action  ?~(parsed 'help' name.u.parsed)
  =/  argument  ?~(parsed '' arg.u.parsed)
  ?:  =('help' action)
    ?.  =(text (topic:help argument))  ~
    :-  ~
    %^  navigation
      input
      (topic:help argument)
    ~[['Tasks' '/work tasks'] ['Projects' '/work projects']]
  ?:  |(=('project-new' action) =('task-new' action))
    ?.  &(=(~ (creation:view action argument)) =(text (creation-help:view action argument)))  ~
    `(navigation input (creation-help:view action argument) ~[['Projects' '/work projects']])
  =/  more  =('more' action)
  =?  action  more  'task'
  ?.  (handles:view action)  ~
  =/  args  (mole |.((read-arguments:view db action (need (arguments:view action argument)))))
  ?~  args  ~
  =/  result
    %-  mole
    |.
    ?>  ?=(%o -.u.args)
    =/  limit  (min 4 (number:j u.args 'limit' 4))
    %:  read:j
      db
      who
      action
      [%o (~(put by (~(put by p.u.args) 'paged' [%b &])) 'limit' (numb:enjs:format limit))]
    ==
  =/  refresh=(list [label=@t command=@t])
    ~[['Refresh view' prompt] ['Projects' '/work projects'] ['Tasks' '/work tasks']]
  ?~  result
    `(navigation input 'This view is unavailable. Refresh to check current access.' refresh)
  =/  links
    ?:(more (all-actions:view action u.args u.result) (actions:view action u.args u.result))
  =/  body  (summary:view action u.args u.result)
  =/  expected  (rap 3 ~[body '\0a' (footer:copy links)])
  ?.  =(text expected)
    `(navigation input 'Work changed. Refresh this view before choosing an action.' refresh)
  `(navigation input body links)
++  navigation
  |=  [input=@uv title=@t links=(list [label=@t command=@t])]
  ^-  @t
  ?>  ?&  (gth (lent links) 0)
          (lte (lent links) 10)
          (lte (met 3 title) 48.000)
      ==
  ?>  %+  levy  links
      |=  link=[label=@t command=@t]
      &((lte (met 3 label.link) 1.000) (lte (met 3 command.link) 1.000))
  =/  numbered
    %+  turn  (gulf 0 (dec (lent links)))
    |=  index=@ud
    (cat 3 'action-' (crip (a-co:co index)))
  =/  groups
    %+  roll  links
    |=  $:  link=[label=@t command=@t]
            groups=[rows=(list json) utilities=(list json) index=@ud]
        ==
    =/  id=json  [%s (snag index.groups numbered)]
    ?:  ?=(^ (utility link))
      [rows.groups (snoc utilities.groups id) +(index.groups)]
    [(snoc rows.groups id) utilities.groups +(index.groups)]
  =/  rows  rows.groups
  =/  utilities  utilities.groups
  =/  text  (trip title)
  =/  split  (find ~[10] text)
  =/  heading  ?~(split title (crip (scag u.split text)))
  =/  body  ?~(split '' (crip (slag +(u.split) text)))
  =/  children=(list json)  (weld ~[[%s 'title'] [%s 'body']] rows)
  =?  children  ?=(^ utilities)
    =/  footer=(list json)  ?~(rows ~[[%s 'utilities']] ~[[%s 'divider'] [%s 'utilities']])
    (weld children footer)
  =/  components=(list json)
    :~  %-  pairs:enjs:format
        :~  ['id' %s 'root']
            ['component' %s 'Column']
            ['children' %a children]
        ==
        %-  pairs:enjs:format
        :~  ['id' %s 'title']
            ['component' %s 'Text']
            ['variant' %s 'h2']
            ['text' %s heading]
        ==
        %-  pairs:enjs:format
        :~  ['id' %s 'body']
            ['component' %s 'Text']
            ['text' %s body]
        ==
    ==
  =?  components  ?=(^ utilities)
    %+  snoc
      components
    (pairs:enjs:format ~[['id' %s 'utilities'] ['component' %s 'Row'] ['children' %a utilities]])
  =?  components  &(?=(^ rows) ?=(^ utilities))
    (snoc components (pairs:enjs:format ~[['id' %s 'divider'] ['component' %s 'Divider']]))
  =/  buttons=(list json)
    =/  remaining  links
    =/  index=@ud  0
    |-  ^-  (list json)
        ?~  remaining  ~
        =/  id  (snag index numbered)
        =/  short  (utility i.remaining)
        ?^  short
          %+  weld
            (button id label.u.short command.i.remaining primary.u.short)
          $(remaining t.remaining, index +(index))
        :-  (choice id label.i.remaining command.i.remaining)
        $(remaining t.remaining, index +(index))
  (surface (cat 3 'harness-work-view-' (scot %uv input)) (weld components buttons) &)
++  utility
  |=  [label=@t command=@t]
  ^-  (unit [label=@t primary=?])
  ::  Only bounded navigation labels use buttons; record names keep wrapping.
  =/  outer  (parse:cmd command)
  ?~  outer  ~
  =/  parsed  (parse:cmd (cat 3 '/' arg.u.outer))
  ?~  parsed  ~
  ?:  |(=('project' name.u.parsed) =('task' name.u.parsed))  ~
  =/  labels=(list [p=@t q=[label=@t primary=?]])
    :~  ['Projects' ['Projects' |]]
        ['Tasks' ['Tasks' |]]
        ['Create project' ['New project' &]]
        ['Add task' ['Add task' &]]
        ['View tasks' ['View tasks' |]]
        ['View projects' ['Projects' |]]
        ['All active projects' ['Projects' |]]
        ['Refresh view' ['Refresh view' |]]
        ['Next page' ['Next page' |]]
        ['Active projects only' ['Active only' |]]
        ['Include archived projects' ['Show archived' |]]
        ['Refresh task' ['Refresh' |]]
        ['Read result' ['Read result' &]]
        ['Review drafts' ['Review drafts' &]]
        ['Save draft' ['Save draft' &]]
        ['Reject draft' ['Reject draft' |]]
        ['Read saved document' ['Saved copy' |]]
        ['Send message' ['Send message' &]]
        ['Cancel' ['Cancel' |]]
        ['More actions' ['More actions' |]]
        ['Details' ['Details' |]]
        ['Check status' ['Check status' &]]
        ['Check delivery' ['Check delivery' &]]
    ==
  (~(get by (my labels)) label)
++  select
  |=  $:  db=state:wc
          sid=@t
          scope=@uv
          source=input-source:h
          input=@uv
          text=@t
          log=(list event:h)
          expected=(unit json)
      ==
  ^-  (unit [id=@uv inspected=?])
  =/  command  (has-command-result input text log)
  =/  direct
    %-  mole
    |.
    ?>  command
    =/  receipt  (need expected)
    ?>  =(text (receipt:view receipt))
    =/  id  (slav %uv (string:j receipt 'id'))
    =/  request  (~(got by requests.db) id)
    ?>  ?&  (matches:control request sid scope source ~)
            =(`[%s action.request] (get:j receipt 'action'))
        ==
    ?>  =(`args.request (get:j receipt 'args'))
    [id &]
  ?^  direct  direct
  ::  A model may prepare work, but its prose cannot unlock Confirm. Match
  ::  the actual human source event; ambiguous multiple preparations use text.
  =/  pending
    %+  skim  ~(tap by requests.db)
    |=  [id=@uv request=request:wc]
    ?&  =(%pending status.request)
        =(source source.request)
        (matches:control request sid scope source ~)
    ==
  ?.  &(?=(^ pending) ?=(~ t.pending))  ~
  `[p.i.pending |]
++  candidate
  |=  [db=state:wc source=input-source:h prompt=@t]
  ^-  (unit @uv)
  =/  outer  (parse:cmd prompt)
  =/  parsed  ?~(outer ~ (parse:cmd (cat 3 '/' arg.u.outer)))
  ?:  ?&  ?=(^ outer)
          =('work' name.u.outer)
          ?=(^ parsed)
          |(=('result' name.u.parsed) =('confirm' name.u.parsed))
      ==
    (mole |.((resolve:control db arg.u.parsed)))
  =/  rows
    %+  skim  ~(tap by requests.db)
    |=  [id=@uv request=request:wc]
    =(source source.request)
  ?.  &(?=(^ rows) ?=(~ t.rows))  ~
  `p.i.rows
++  send-action
  |=  command=@t
  ^-  json
  %-  pairs:enjs:format
  :~  :-  'event'
      %-  pairs:enjs:format
      :~  ['name' %s 'tlon.sendMessage']
          ['context' (pairs:enjs:format ~[['text' %s command]])]
      ==
  ==
++  choice
  |=  [id=@t label=@t command=@t]
  ^-  json
  =/  option
    %-  pairs:enjs:format
    :~  ['id' %s id]
        ['label' %s label]
        ['action' (send-action command)]
    ==
  %-  pairs:enjs:format
  :~  ['id' %s id]
      ['component' %s 'Choice']
      ['options' %a ~[option]]
  ==
++  button
  |=  [id=@t label=@t command=@t primary=?]
  ^-  (list json)
  :~  %-  pairs:enjs:format
      :~  ['id' %s id]
          ['component' %s 'Button']
          ['variant' %s ?:(primary 'primary' 'secondary')]
          ['child' %s (cat 3 id '-label')]
          ['action' (send-action command)]
      ==
      %-  pairs:enjs:format
      :~  ['id' %s (cat 3 id '-label')]
          ['component' %s 'Text']
          ['text' %s label]
      ==
  ==
++  render
  |=  [id=@uv request=request:wc inspected=? current=? value=json]
  ^-  @t
  =/  key  (key:copy value)
  =/  ready  &(inspected current =(%pending status.request))
  ?:  &(inspected !current =(%pending status.request))
    %^  navigation
      id
      'This approval changed or expired.\0aOpen the task or project and choose the change again.'
    ~[['Tasks' '/work tasks'] ['Projects' '/work projects']]
  ?:  &(inspected |(current !=(%pending status.request)))
    %^  navigation
      id
      (rap 3 ~[(summary:copy value) ?:(ready '\0a\0aPlease confirm within 15 minutes.' '')])
    (links:copy value)
  =/  message
    ?:  !current
      'This approval changed or expired.'
    (cat 3 'Review the proposed change to ' (title:copy value))
  ::  Uninspected model replies keep their ordinary prose; the optional card
  ::  only opens a head-generated preview and cannot hide the model's answer.
  =/  components=(list json)
    :~  %-  pairs:enjs:format
        :~  ['id' %s 'root']
            ['component' %s 'Column']
            ['children' %a ~[[%s 'title'] [%s 'inspect']]]
        ==
        (pairs:enjs:format ~[['id' %s 'title'] ['component' %s 'Text'] ['text' %s message]])
    ==
  %^  surface
    (cat 3 'harness-work-' key)
    (weld components (button 'inspect' 'Review' (cat 3 '/work result ' key) &))
  |
++  surface
  |=  [surface=@t components=(list json) fallback=?]
  ^-  @t
  =/  create
    %-  pairs:enjs:format
    :~  ['version' %s 'v0.9']
        :-  'createSurface'
        %-  pairs:enjs:format
        :~  ['surfaceId' %s surface]
            ['catalogId' %s 'tlon.a2ui.basic.v1']
        ==
    ==
  =/  update
    %-  pairs:enjs:format
    :~  ['version' %s 'v0.9']
        :-  'updateComponents'
        %-  pairs:enjs:format
        :~  ['surfaceId' %s surface]
            ['root' %s 'root']
            ['components' %a components]
        ==
    ==
  =/  entry
    %-  pairs:enjs:format
    :~  ['type' %s 'a2ui']
        ['version' %n '1']
        ['messages' %a ~[create update]]
    ==
  ?>  ?=(%o -.entry)
  =?  entry  fallback  [%o (~(put by p.entry) 'storyMode' [%s 'fallback'])]
  (en:json:html [%a ~[entry]])
--

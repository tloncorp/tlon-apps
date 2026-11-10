::  Human consequences, not a serialization of work records.
/+  j=harness-workspace-json
|%
++  ref
  |=  [kind=@t id=@t]
  (cat 3 kind (crip (a-co:co (end [0 32] (sham id)))))
++  key
  |=  value=json
  ::  Approval text is an exact-content witness, so its key retains the full
  ::  digest. Short navigation references never substitute for this proof.
  =/  identity
    %-  pairs:enjs:format
    :~  ['id' (fall (get:j value 'id') ~)]
        ['action' (fall (get:j value 'action') ~)]
        ['args' (fall (get:j value 'args') ~)]
    ==
  (cat 3 'r' (crip (a-co:co (sham identity))))
++  resolve
  |=  [kind=@t token=@t ids=(list @t)]
  ^-  @t
  =/  found  (skim ids |=(id=@t |(=(id token) =((ref kind id) token))))
  ?>  &(?=(^ found) ?=(~ t.found))
  i.found
++  object
  |=  [value=json key=@t]
  ^-  json
  =/  found  (get:j value key)
  ?~  found  [%o ~]
  ?:(?=([%o *] u.found) u.found [%o ~])
++  string
  |=  [value=json key=@t]
  (fall (optional:j value key) '')
++  line
  |=  text=@t
  %-  crip
  %+  turn  (trip text)
  |=  char=@t
  ?:(|(=(127 char) (lth char 32)) ' ' char)
++  quoted
  |=  text=@t
  (rap 3 ~['“' (line text) '”'])
++  title
  |=  value=json
  ^-  @t
  =/  args  (object value 'args')
  =/  subject  (object value 'subject')
  =/  result  (object value 'result')
  =/  candidates=(list @t)
    :~  (string subject 'title')
        (string (object result 'task') 'title')
        (string args 'title')
        (string result 'title')
    ==
  =/  found  (skim candidates |=(s=@t !=('' s)))
  ?~  found  'this work'
  (quoted i.found)
++  status
  |=  raw=@t
  ?:  =('open' raw)  'Open'
  ?:  =('claimed' raw)  'Assigned'
  ?:  =('blocked' raw)  'Needs attention'
  ?:  =('done' raw)  'Complete'
  raw
++  action-label
  |=  action=@t
  ^-  @t
  =/  names=(list [p=@t q=@t])
    :~  ['task-create' 'Add task']
        ['task-update' 'Save changes']
        ['task-claim' 'Take task']
        ['task-reply' 'Send message']
        ['project-create' 'Create project']
        ['project-edit' 'Save project']
        ['review' 'Save draft']
        ['artifact-create' 'Create draft']
        ['artifact-save' 'Save document']
        ['artifact-archive' 'Archive document']
        ['propose' 'Submit draft']
        ['publish' 'Publish document']
        ['unpublish' 'Unpublish document']
        ['member' 'Change access']
        ['hand-access' 'Change access']
    ==
  (fall (~(get by (my names)) action) 'Confirm')
++  field
  |=  [value=json key=@t label=@t]
  =/  text  (string value key)
  ?:  =('' text)  ''
  (rap 3 ~['\0a\0a' label text])
++  sources
  |=  value=json
  ^-  @t
  =/  all  (get:j value 'sources')
  ?.  &(?=(^ all) ?=(%a -.u.all) ?=(^ p.u.all))  ''
  %+  cat  3
  :-  '\0a\0aSources:\0a'
  %+  rap  3
  %+  turn  p.u.all
  |=  source=json
  (rap 3 ~[(line (string source 'label')) ' — ' (string source 'url') '\0a'])
++  document
  |=  value=json
  (rap 3 ~[(field value 'body' '') (sources value)])
++  changes
  |=  args=json
  ^-  @t
  ::  Author-facing fields retain complete values. Versions and routing keys
  ::  bind the canonical request, not the human's reading task.
  %-  rap
  :-  3
  :~  (field args 'title' 'Title: ')
      (field args 'description' '')
      (field args 'status' 'Task status: ')
      (field args 'outcome' '')
      (field args 'reason' 'Reason: ')
      (document args)
      ?:(=(`[%s ''] (get:j args 'description')) '\0a\0aDescription: empty.' '')
      ?:(=(`[%s ''] (get:j args 'outcome')) '\0a\0aOutcome: empty.' '')
  ==
++  summary
  |=  value=json
  ^-  @t
  =/  action  (string value 'action')
  =/  phase  (string value 'status')
  =/  args  (object value 'args')
  =/  name  (title value)
  |^
    ?:  =('rejected' phase)  'Cancelled. Nothing was changed.'
    ?:  =('failed' phase)
      (cat 3 'That change did not complete.' (field value 'result' '\0a'))
    ?:  =('running' phase)  (cat 3 'Saving changes to ' (cat 3 name '.'))
    ?:  =('done' phase)  completed
    preview
  ::
  ++  completed
    ?:  =('task-create' action)  (rap 3 ~['Added ' name '.'])
    ?:  =('project-create' action)  (rap 3 ~['Created ' name '.'])
    ?:  =('task-reply' action)  delivery-summary
    ?:  =('review' action)
      ?:  (boolean:j args 'accept' |)  (rap 3 ~['Saved the draft for ' name '.'])
      (rap 3 ~['Rejected the draft for ' name '.'])
    ?:  =('publish' action)  (rap 3 ~['Published ' name '.'])
    ?:  =('unpublish' action)  (rap 3 ~['Removed the public page for ' name '.'])
    (rap 3 ~['Saved changes to ' name '.'])
  ::
  ++  delivery-summary
    =/  delivery  (object value 'delivery')
    =/  state  (string delivery 'status')
    =/  destination  (string delivery 'address')
    =/  where  ?:(=('' destination) '' (cat 3 ' to ' (line destination)))
    ?:  =('delivered' state)  (rap 3 ~['Sent the result' where '.'])
    ?:  =('uncertain' state)
      'Delivery could not be verified. Check the destination before sending again.'
    ?:  =('failed' state)
      'The message was not delivered. Check delivery details before trying again.'
    ?:  =('abandoned' state)  'This delivery is abandoned. It will not be retried.'
    (rap 3 ~['The result is queued' where '.\0aDelivery is not confirmed yet.'])
  ::
  ++  preview
    =/  project  (field value 'projectTitle' 'Project: ')
    ?:  =('task-reply' action)
      =/  reply  (object value 'reply')
      %-  rap
      :-  3
      :~  'Send this result?'
          (field reply 'address' 'Conversation: ')
          (field reply 'actor' 'Recipient: ')
          (field reply 'text' '')
      ==
    ?:  =('review' action)
      =/  content  (object (object value 'proposal') 'content')
      %-  rap
      :-  3
      :~  ?:((boolean:j args 'accept' |) 'Save this draft?' 'Reject this draft?')
          (field content 'title' '')
          (document content)
          (field args 'reason' 'Reason: ')
          ?:  (boolean:j args 'accept' |)
            '\0a\0aSaves the document without sending or publishing it.'
          ''
      ==
    ?:  =('publish' action)
      =/  content  (object (object value 'publication') 'content')
      %-  rap
      :-  3
      :~  'Publish this document?\0a\0aAnyone with the public link can read this revision.'
          (field content 'title' '')
          (document content)
      ==
    ?:  =('unpublish' action)  (rap 3 ~['Remove the public page for ' name '?'])
    ?:  =('member' action)
      %-  rap
      :-  3
      :~  'Change access to '
          name
          '?'
          (field args 'scope' 'Agent: ')
          (field args 'role' 'Role: ')
          ?:(=(~ (fall (get:j args 'role') ~)) '\0aRemove this agent’s project access.' '')
      ==
    ?:  =('hand-access' action)
      %-  rap
      :-  3
      :~  ?:  (boolean:j args 'owner' |)
            'Allow work management from this conversation?'
          'Remove work management access?'
          (field args 'actor' 'Person: ')
          (field args 'binding' 'Connection: ')
      ==
    =/  linked
      ?:  =(`~ (get:j args 'artifact'))  '\0a\0aRemove the linked result.'
      ?~  (optional:j args 'artifact')  ''
      (field value 'artifactTitle' 'Result: ')
    %-  rap
    :-  3
    :~  (action-label action)
        ?:(=('this work' name) '' (cat 3 ' for ' name))
        '?'
        project
        (changes args)
        linked
        ?:  (boolean:j args 'archived' |)  '\0a\0aArchive this record.'
        ?:(=(`[%b |] (get:j args 'archived')) '\0a\0aKeep this record active.' '')
    ==
  --
++  links
  |=  value=json
  ^-  (list [label=@t command=@t])
  =/  action  (string value 'action')
  =/  phase  (string value 'status')
  =/  id  (key value)
  =/  inspect  (cat 3 '/work result ' id)
  =/  technical  (cat 3 '/work details ' id)
  =/  args  (object value 'args')
  =/  result  (object value 'result')
  =/  target  (string args 'id')
  =?  target  =('' target)  (string result 'id')
  =?  target  =('' target)  (string (object result 'task') 'id')
  ?:  =('pending' phase)
    =/  label
      ?:(&(=('review' action) !(boolean:j args 'accept' |)) 'Reject draft' (action-label action))
    :~  [label (cat 3 '/work confirm ' id)]  ['Cancel' (cat 3 '/work reject ' id)]
        ['Details' technical]
    ==
  ?:  =('running' phase)  ~[['Check status' inspect] ['Details' technical]]
  ?:  =('task-reply' action)  ~[['Check delivery' inspect] ['Details' technical]]
  ?:  &(=('done' phase) !=('' target))
    ?:  =('task-create' action)
      ~[['View task' (cat 3 '/work task ' (ref 't' target))] ['Details' technical]]
    ?:  =('project-create' action)
      ~[['Open project' (cat 3 '/work project ' (ref 'p' target))] ['Details' technical]]
    ~[['Tasks' '/work tasks'] ['Details' technical]]
  ~[['Details' technical]]
++  footer
  |=  links=(list [label=@t command=@t])
  %+  rap  3
  %+  turn  links
  |=  [label=@t command=@t]
  (rap 3 ~['\0a' label ': ' command])
++  receipt
  |=  value=json
  %-  rap
  :-  3
  :~  (summary value)
      ?:(=('pending' (string value 'status')) '\0a\0aPlease confirm within 15 minutes.' '')
      '\0a'
      (footer (links value))
  ==
--

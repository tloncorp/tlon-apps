::  Human entry points. Structured receipts belong to tools and Details.
/+  view=harness-work-view, j=harness-workspace-json
|%
++  overview
  ^-  @t
  'Tell me what you want done here in chat. I handle the work and reply here.\0a\0aTasks: /work tasks\0aProjects: /work projects'
++  topic
  |=  name=@t
  ^-  @t
  ?:  |(=('' name) =('{}' name))  overview
  ?:  =('projects' name)
    'Projects keep related work together.\0a\0aOpen yours: /work projects\0aCreate one: /work project-new Weekend plans'
  ?:  =('tasks' name)
    'A task is a piece of work. A project groups related tasks. Neither needs setting up before you ask for help.\0a\0aTell me what you want done, or ask what is outstanding.\0aView tasks: /work tasks'
  ?:  =('review' name)
    'Open a task’s result to read it. Save draft keeps an accepted copy; sending is a separate choice.\0a\0aBefore a send, you see the exact message and destination. Check delivery tells you whether it arrived.\0a\0aChoose a task: /work tasks'
  'Open /work tasks to pick up your work, or /work projects to organize it.'
++  reply
  |=  result=(each json @t)
  ^-  @t
  ?:  ?=(%| -.result)  (cat 3 'error: ' p.result)
  ?:  ?=(%s -.p.result)  p.p.result
  ?:  ?&  ?=(^ (get:j p.result 'title'))  ?=(^ (get:j p.result 'status'))
          ?=(^ (get:j p.result 'project'))
      ==
    (render:view 'task' [%o ~] p.result)
  ?:  ?&  ?=(^ (get:j p.result 'title'))  ?=(^ (get:j p.result 'members'))
          ?=(^ (get:j p.result 'archived'))
      ==
    (render:view 'project' [%o ~] p.result)
  ?:  ?&  ?=(^ (get:j p.result 'inspect'))  ?=(^ (get:j p.result 'args'))
          ?=(^ (get:j p.result 'status'))
      ==
    (receipt:view p.result)
  (en:json:html p.result)
--

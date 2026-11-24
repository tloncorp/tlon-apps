/-  c=harness-work-control
/+  *test, help=harness-work-help, control=harness-work-control, view=harness-work-view
|%
++  test-human-help-is-short-and-divided-by-task
  ;:  weld
      (expect-eq !>(overview:help) !>((topic:help '')))
      (expect-eq !>(overview:help) !>((topic:help '{}')))
      (expect !>((lth (met 3 overview:help) 900)))
      (expect !>((lth (met 3 (topic:help 'tasks')) 1.000)))
      (expect !>(!=(overview:help (topic:help 'tasks'))))
      (expect !>(!=(overview:help (topic:help 'projects'))))
      (expect !>(!=(overview:help (topic:help 'review'))))
      (expect-eq !>((topic:help 'unknown')) !>((topic:help 'typo')))
  ==
++  test-human-strings-and-complete-approval-previews-are-readable
  =/  r=request:c  *request:c
  =.  r
    %=  r  action  'project-create'  status  %pending  args
        (pairs:enjs:format ~[['title' %s 'Exact "quoted" title']])
    ==
  =/  receipt  (encode:control 0v3 r)
  ;:  weld
      (expect-eq !>('Line one\0aLine two') !>((reply:help [%& [%s 'Line one\0aLine two']])))
      (expect-eq !>(overview:help) !>((reply:help [%& [%s overview:help]])))
      (expect-eq !>((receipt:view receipt)) !>((reply:help [%& receipt])))
      (expect !>(?=(^ (find (trip 'Exact "quoted" title') (trip (reply:help [%& receipt]))))))
      (expect-eq !>('error: No access') !>((reply:help [%| 'No access'])))
  ==
--

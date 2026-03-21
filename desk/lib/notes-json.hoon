::  lib/notes-json: JSON encoding/decoding for notes types
::
/-  notes
|%
::  +da-to-unix: convert @da to unix seconds
++  da-to-unix
  |=  da=@da
  ^-  @ud
  (div (sub da ~1970.1.1) ~s1)
::
::  +enjs: encode notes types to JSON
++  enjs
  =,  enjs:format
  |%
  ++  notebook
    |=  nb=notebook:notes
    ^-  json
    %-  pairs
    :~  ['id' (numb id.nb)]
        ['title' s+title.nb]
        ['createdBy' s+(scot %p created-by.nb)]
        ['createdAt' (numb (da-to-unix created-at.nb))]
        ['updatedAt' (numb (da-to-unix updated-at.nb))]
    ==
  ::
  ++  folder
    |=  fld=folder:notes
    ^-  json
    %-  pairs
    :~  ['id' (numb id.fld)]
        ['notebookId' (numb notebook-id.fld)]
        ['name' s+name.fld]
        ['parentFolderId' ?~(parent-folder-id.fld ~ (numb u.parent-folder-id.fld))]
        ['createdBy' s+(scot %p created-by.fld)]
        ['createdAt' (numb (da-to-unix created-at.fld))]
        ['updatedAt' (numb (da-to-unix updated-at.fld))]
    ==
  ::
  ++  note
    |=  nt=note:notes
    ^-  json
    %-  pairs
    :~  ['id' (numb id.nt)]
        ['notebookId' (numb notebook-id.nt)]
        ['folderId' (numb folder-id.nt)]
        ['title' s+title.nt]
        ['slug' ?~(slug.nt ~ s+u.slug.nt)]
        ['bodyMd' s+body-md.nt]
        ['createdBy' s+(scot %p created-by.nt)]
        ['createdAt' (numb (da-to-unix created-at.nt))]
        ['updatedBy' s+(scot %p updated-by.nt)]
        ['updatedAt' (numb (da-to-unix updated-at.nt))]
        ['revision' (numb revision.nt)]
    ==
  ::
  ++  event
    |=  evt=event:notes
    ^-  json
    %-  pairs
    ?-  -.evt
        %notebook-created
      :~  ['type' s+'notebook-created']
          ['notebookId' (numb notebook-id.evt)]
          ['actor' s+(scot %p actor.evt)]
      ==
        %notebook-renamed
      :~  ['type' s+'notebook-renamed']
          ['notebookId' (numb notebook-id.evt)]
          ['actor' s+(scot %p actor.evt)]
      ==
        %member-invited
      :~  ['type' s+'member-invited']
          ['notebookId' (numb notebook-id.evt)]
          ['who' s+(scot %p who.evt)]
          ['role' s+(scot %tas role.evt)]
          ['actor' s+(scot %p actor.evt)]
      ==
        %member-removed
      :~  ['type' s+'member-removed']
          ['notebookId' (numb notebook-id.evt)]
          ['who' s+(scot %p who.evt)]
          ['actor' s+(scot %p actor.evt)]
      ==
        %role-changed
      :~  ['type' s+'role-changed']
          ['notebookId' (numb notebook-id.evt)]
          ['who' s+(scot %p who.evt)]
          ['role' s+(scot %tas role.evt)]
          ['actor' s+(scot %p actor.evt)]
      ==
        %folder-created
      :~  ['type' s+'folder-created']
          ['folderId' (numb folder-id.evt)]
          ['notebookId' (numb notebook-id.evt)]
          ['actor' s+(scot %p actor.evt)]
      ==
        %folder-renamed
      :~  ['type' s+'folder-renamed']
          ['folderId' (numb folder-id.evt)]
          ['notebookId' (numb notebook-id.evt)]
          ['actor' s+(scot %p actor.evt)]
      ==
        %folder-moved
      :~  ['type' s+'folder-moved']
          ['folderId' (numb folder-id.evt)]
          ['notebookId' (numb notebook-id.evt)]
          ['actor' s+(scot %p actor.evt)]
      ==
        %folder-deleted
      :~  ['type' s+'folder-deleted']
          ['folderId' (numb folder-id.evt)]
          ['notebookId' (numb notebook-id.evt)]
          ['actor' s+(scot %p actor.evt)]
      ==
        %note-created
      :~  ['type' s+'note-created']
          ['noteId' (numb note-id.evt)]
          ['notebookId' (numb notebook-id.evt)]
          ['actor' s+(scot %p actor.evt)]
      ==
        %note-renamed
      :~  ['type' s+'note-renamed']
          ['noteId' (numb note-id.evt)]
          ['notebookId' (numb notebook-id.evt)]
          ['actor' s+(scot %p actor.evt)]
      ==
        %note-moved
      :~  ['type' s+'note-moved']
          ['noteId' (numb note-id.evt)]
          ['notebookId' (numb notebook-id.evt)]
          ['folderId' (numb folder-id.evt)]
          ['actor' s+(scot %p actor.evt)]
      ==
        %note-deleted
      :~  ['type' s+'note-deleted']
          ['noteId' (numb note-id.evt)]
          ['notebookId' (numb notebook-id.evt)]
          ['actor' s+(scot %p actor.evt)]
      ==
        %note-updated
      :~  ['type' s+'note-updated']
          ['noteId' (numb note-id.evt)]
          ['notebookId' (numb notebook-id.evt)]
          ['revision' (numb revision.evt)]
          ['actor' s+(scot %p actor.evt)]
      ==
    ==
  --
::
::  +dejs: decode JSON to notes types
++  dejs
  =,  dejs:format
  |%
  ::  +role: parse role string
  ++  role
    |=  jon=json
    ^-  role:notes
    ?>  ?=([%s *] jon)
    ?+  p.jon  ~|(%bad-role !!)
      %'owner'   %owner
      %'editor'  %editor
      %'viewer'  %viewer
    ==
  ::  +action: parse action from JSON
  ::  format: {"action-name": {fields...}}
  ++  action
    |=  jon=json
    ^-  action:notes
    ?>  ?=([%o *] jon)
    =/  entries=(list [key=@t val=json])  ~(tap by p.jon)
    ?>  ?=(^ entries)
    =/  tag=@t  key.i.entries
    =/  val=json  val.i.entries
    ?+  tag  ~|(unknown-action+tag !!)
    ::
        %'create-notebook'
      [%create-notebook (so val)]
    ::
        %'rename-notebook'
      :-  %rename-notebook
      ((ot ~[['notebookId' ni] ['title' so]]) val)
    ::
        %'invite-member'
      :-  %invite-member
      ((ot ~[['notebookId' ni] ['who' (se %p)] ['role' role]]) val)
    ::
        %'remove-member'
      :-  %remove-member
      ((ot ~[['notebookId' ni] ['who' (se %p)]]) val)
    ::
        %'set-role'
      :-  %set-role
      ((ot ~[['notebookId' ni] ['who' (se %p)] ['role' role]]) val)
    ::
        %'create-folder'
      :-  %create-folder
      ((ot ~[['notebookId' ni] ['parentFolderId' (mu ni)] ['name' so]]) val)
    ::
        %'rename-folder'
      :-  %rename-folder
      ((ot ~[['notebookId' ni] ['folderId' ni] ['name' so]]) val)
    ::
        %'move-folder'
      :-  %move-folder
      ((ot ~[['notebookId' ni] ['folderId' ni] ['newParentFolderId' ni]]) val)
    ::
        %'delete-folder'
      :-  %delete-folder
      ((ot ~[['notebookId' ni] ['folderId' ni] ['recursive' bo]]) val)
    ::
        %'create-note'
      :-  %create-note
      ((ot ~[['notebookId' ni] ['folderId' ni] ['title' so] ['bodyMd' so]]) val)
    ::
        %'rename-note'
      :-  %rename-note
      ((ot ~[['notebookId' ni] ['noteId' ni] ['title' so]]) val)
    ::
        %'move-note'
      :-  %move-note
      ((ot ~[['noteId' ni] ['notebookId' ni] ['folderId' ni]]) val)
    ::
        %'delete-note'
      :-  %delete-note
      ((ot ~[['noteId' ni] ['notebookId' ni]]) val)
    ::
        %'update-note'
      :-  %update-note
      ((ot ~[['noteId' ni] ['bodyMd' so] ['expectedRevision' ni]]) val)
    ==
  --
--

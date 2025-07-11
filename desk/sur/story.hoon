/-  c=cite
|%
::  $story: styled content
::
+$  story  (list verse)
::  $verse: a chunk of styled content
::
::    blocks stand on their own. inlines come in groups and get wrapped
::    into a paragraph
::
+$  verse
  $%  [%block p=block]
      [%inline p=(list inline)]
  ==
::  $listing: recursive type for infinitely nested <ul> or <ol>
+$  listing
  $%  [%list p=?(%ordered %unordered %tasklist) q=(list listing) r=(list inline)]
      [%item p=(list inline)]
  ==
::  $block: post content that sits outside of the normal text
::
::    %image: a visual, we record dimensions for better rendering
::    %cite: a reference
::    %header: a traditional html heading, h1-h6
::    %listing: a traditional html list, ul and ol
::    %code: a block of code
::
+$  block
  $+  style-block
  $%  [%image src=cord height=@ud width=@ud alt=cord]
      [%cite =cite:c]
      [%header p=?(%h1 %h2 %h3 %h4 %h5 %h6) q=(list inline)]
      [%listing p=listing]
      [%rule ~]
      [%code code=cord lang=cord]
      [%link url=@t meta=(map ?(link-meta-key @t) @t)]
  ==
::  $link-meta-key: known-good %link $block meta keys
::
+$  link-meta-key
  ?(%title %description %image %site-name %site-icon)
::  $inline: content that flows within a paragraph
::
::    @t: plain text
::    %italics: italic text
::    %bold: bold text
::    %strike: strikethrough text
::    %blockquote: blockquote surrounded content
::    %inline-code: code formatting for small snippets
::    %code: code formatting for large snippets
::    %ship: identity
::    %role: member role
::    %block: link/reference to blocks
::    %tag: tag gets special signifier
::    %link: link to a URL with a face
::    %task: a todo list
::    %break: line break
::
+$  inline  $+  channel-inline
  $@  @t
  $%  [%italics p=(list inline)]
      [%bold p=(list inline)]
      [%strike p=(list inline)]
      [%blockquote p=(list inline)]
      [%inline-code p=cord]
      [%code p=cord]
      [%ship p=ship]
      [%sect p=?(~ sect)]
      [%block p=@ud q=cord]
      [%tag p=cord]
      [%link p=cord q=cord]
      [%task p=?(%.y %.n) q=(list inline)]
      [%break ~]
  ==
+$  sect  term
++  ver
  |%
  ++  v0
    |% 
    +$  story  (list verse)
    +$  verse
      $%  [%block p=block]
          [%inline p=(list inline)]
      ==
    +$  listing
      $%  [%list p=?(%ordered %unordered %tasklist) q=(list listing) r=(list inline)]
          [%item p=(list inline)]
      ==
    +$  block
      $%  [%image src=cord height=@ud width=@ud alt=cord]
          [%cite =cite:c]
          [%header p=?(%h1 %h2 %h3 %h4 %h5 %h6) q=(list inline)]
          [%listing p=listing]
          [%rule ~]
          [%code code=cord lang=cord]
      ==
    +$  inline
      $@  @t
      $%  [%italics p=(list inline)]
          [%bold p=(list inline)]
          [%strike p=(list inline)]
          [%blockquote p=(list inline)]
          [%inline-code p=cord]
          [%code p=cord]
          [%ship p=ship]
          [%block p=@ud q=cord]
          [%tag p=cord]
          [%link p=cord q=cord]
          [%task p=?(%.y %.n) q=(list inline)]
          [%break ~]
      ==
    --
  --
--

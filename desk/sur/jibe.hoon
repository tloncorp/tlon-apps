/-  cite
=<  jibe
|%
+$  jibe
  (pair (list block) (list inline))
::
+$  inline
  $@  @t
  $%  [%italics p=(list inline)]
      [%bold p=(list inline)]
      [%strike p=(list inline)]
      [%blockquote p=(list inline)]
      [%inline-code p=cord]
      [%ship p=ship]
      [%block p=@ud q=cord]
      [%code p=cord]
      [%tag p=cord]
      [%link p=cord q=cord]
      [%break ~]
  ==
::
+$  block
  $%  [%image src=cord height=@ud width=@ud alt=cord]
      [%cite =cite]
  ==
::
--

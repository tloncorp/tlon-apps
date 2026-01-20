::  /sur/eval.hoon - Structures for inline Hoon evaluation
::
|%
::  Input for eval thread - the Hoon code to evaluate
::
+$  eval-input  cord
::  Output from eval thread - status and result/error message
::
+$  eval-output
  $:  status=?(%ok %error)
      output=cord
  ==
--

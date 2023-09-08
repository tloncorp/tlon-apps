import { citeToPath, useCopy } from '@/logic/utils';
import {
  useArrangedNotes,
  useArrangedNotesMutation,
  useDeleteNoteMutation,
} from '@/state/channel/channel';
import { decToUd } from '@urbit/api';
import { useState, useCallback, MouseEvent } from 'react';
import { useNavigate } from 'react-router';

interface useDiaryActionsParams {
  flag: string;
  time: string;
}

export default function useDiaryActions({ flag, time }: useDiaryActionsParams) {
  const [isOpen, setIsOpen] = useState(false);
  const arrangedNotes = useArrangedNotes(flag);
  const navigate = useNavigate();
  const { mutate: deleteNote } = useDeleteNoteMutation();
  const { mutate: arrangedNotesMutation } = useArrangedNotesMutation();
  const nest = `diary/${flag}`;
  const { doCopy, didCopy } = useCopy(
    citeToPath({
      chan: {
        nest,
        where: `/note/${time}`,
      },
    })
  );

  const addToArrangedNotes = useCallback(() => {
    const newArranagedNotes = [...arrangedNotes, time.toString()];
    arrangedNotesMutation({
      arrangedNotes: newArranagedNotes,
      nest,
    });
  }, [arrangedNotesMutation, nest, time, arrangedNotes]);

  const removeFromArrangedNotes = useCallback(() => {
    const newArranagedNotes = arrangedNotes.filter(
      (note) => note !== time.toString()
    );
    arrangedNotesMutation({
      arrangedNotes: newArranagedNotes,
      nest,
    });
  }, [arrangedNotesMutation, nest, time, arrangedNotes]);

  const moveUpInArrangedNotes = useCallback(() => {
    const newArranagedNotes = arrangedNotes.filter(
      (note) => note !== time.toString()
    );
    const index = arrangedNotes.indexOf(time.toString());
    newArranagedNotes.splice(index - 1, 0, time.toString());
    arrangedNotesMutation({
      arrangedNotes: newArranagedNotes,
      nest,
    });
  }, [arrangedNotesMutation, nest, time, arrangedNotes]);

  const moveDownInArrangedNotes = useCallback(() => {
    const newArranagedNotes = arrangedNotes.filter(
      (note) => note !== time.toString()
    );
    const index = arrangedNotes.indexOf(time.toString());
    newArranagedNotes.splice(index + 1, 0, time.toString());
    arrangedNotesMutation({
      arrangedNotes: newArranagedNotes,
      nest,
    });
  }, [arrangedNotesMutation, nest, time, arrangedNotes]);

  const delNote = useCallback(async () => {
    deleteNote({ nest, time: decToUd(time) });
    navigate('../');
  }, [nest, time, deleteNote, navigate]);

  const onCopy = useCallback(
    (e: Event | MouseEvent<any>) => {
      e.preventDefault();
      doCopy();
      setTimeout(() => {
        setIsOpen(false);
      }, 1000);
    },
    [doCopy]
  );

  return {
    isOpen,
    didCopy,
    setIsOpen,
    onCopy,
    delNote,
    addToArrangedNotes,
    removeFromArrangedNotes,
    moveUpInArrangedNotes,
    moveDownInArrangedNotes,
  };
}

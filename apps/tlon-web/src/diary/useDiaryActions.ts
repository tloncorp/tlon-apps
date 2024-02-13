import { citeToPath, useCopy } from '@/logic/utils';
import {
  useArrangedPosts,
  useArrangedPostsMutation,
  useDeletePostMutation,
} from '@/state/channel/channel';
import { decToUd } from '@urbit/api';
import { MouseEvent, useCallback, useState } from 'react';
import { useNavigate } from 'react-router';

interface useDiaryActionsParams {
  flag: string;
  time: string;
}

export default function useDiaryActions({ flag, time }: useDiaryActionsParams) {
  const [isOpen, setIsOpen] = useState(false);
  const arrangedNotes = useArrangedPosts(`diary/${flag}`);
  const navigate = useNavigate();
  const { mutate: deleteNote, isLoading: isDeleteLoading } =
    useDeletePostMutation();
  const { mutate: arrangedNotesMutation } = useArrangedPostsMutation();
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
      arrangedPosts: newArranagedNotes,
      nest,
    });
  }, [arrangedNotesMutation, nest, time, arrangedNotes]);

  const removeFromArrangedNotes = useCallback(() => {
    const newArranagedNotes = arrangedNotes.filter(
      (note) => note !== time.toString()
    );
    arrangedNotesMutation({
      arrangedPosts: newArranagedNotes,
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
      arrangedPosts: newArranagedNotes,
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
      arrangedPosts: newArranagedNotes,
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
    isDeleteLoading,
    addToArrangedNotes,
    removeFromArrangedNotes,
    moveUpInArrangedNotes,
    moveDownInArrangedNotes,
  };
}

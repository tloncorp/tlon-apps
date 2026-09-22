import { Attachment } from '@tloncorp/shared';
import { expect, test, vi } from 'vitest';

import { createReferenceExtractor } from './references';

const REF_PATH =
  '/1/chan/chat/~pilwes-hosren/v2dljqi9/msg/170141184508122822886600330000000000000';

test('converts a pasted reference path into an attachment', () => {
  const addAttachment = vi.fn();

  const result = createReferenceExtractor()(REF_PATH, addAttachment);

  expect(result).toEqual({ text: '', hadReferences: true });
  expect(addAttachment).toHaveBeenCalledTimes(1);
  expect(addAttachment).toHaveBeenCalledWith(
    expect.objectContaining({ type: 'reference', path: REF_PATH })
  );
});

test('converts the same reference path when it is pasted a second time', () => {
  const attachments: Attachment[] = [];
  const addAttachment = (attachment: Attachment) => {
    attachments.push(attachment);
  };
  const extractReferences = createReferenceExtractor();

  extractReferences(REF_PATH, addAttachment);
  const second = extractReferences(REF_PATH, addAttachment);

  expect(second).toEqual({ text: '', hadReferences: true });
  expect(attachments).toHaveLength(2);
});

test('leaves text without a reference path unchanged', () => {
  const addAttachment = vi.fn();

  const result = createReferenceExtractor()('hello there', addAttachment);

  expect(result).toEqual({ text: 'hello there', hadReferences: false });
  expect(addAttachment).not.toHaveBeenCalled();
});

test('ignores text echoed back after a reference path could not be parsed', () => {
  const addAttachment = vi.fn();
  const unparseablePath = '/1/chan/broken';
  const extractReferences = createReferenceExtractor();

  const first = extractReferences(unparseablePath, addAttachment);
  const echo = extractReferences(unparseablePath, addAttachment);

  expect(first).toEqual({ text: unparseablePath, hadReferences: true });
  expect(echo).toBeNull();
  expect(addAttachment).not.toHaveBeenCalled();
});

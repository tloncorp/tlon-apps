type ChannelOrderedPost = {
  receivedAt: number;
  sequenceNum?: number | null;
};

export function followsByChannelOrder(
  candidate: ChannelOrderedPost,
  reference: ChannelOrderedPost
) {
  if (
    candidate.sequenceNum != null &&
    candidate.sequenceNum > 0 &&
    reference.sequenceNum != null &&
    reference.sequenceNum > 0 &&
    candidate.sequenceNum !== reference.sequenceNum
  ) {
    return candidate.sequenceNum > reference.sequenceNum;
  }
  return candidate.receivedAt > reference.receivedAt;
}

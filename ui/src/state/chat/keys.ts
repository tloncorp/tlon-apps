export const pinsKey = () => ['dms', 'pins'];
export const infiniteDmsKey = (whom: string) => ['dms', 'infinite', whom];

const DmQueryKeys = {
  pins: pinsKey,
  infinite: infiniteDmsKey,
};

export default DmQueryKeys;

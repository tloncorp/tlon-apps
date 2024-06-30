export const capitalize = (str: string) => {
  return str.charAt(0).toUpperCase() + str.slice(1);
};

export const numberWithMax = (n: number, maxCount: number, suffix = '+') => {
  if (n > maxCount) {
    return `${maxCount}${suffix}`;
  }
  return n.toString();
};

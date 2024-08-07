export const capitalize = (str: string) => {
  return str.charAt(0).toUpperCase() + str.slice(1);
};

export const numberWithMax = (n: number, maxCount: number, suffix = '+') => {
  if (n > maxCount) {
    return `${maxCount}${suffix}`;
  }
  return n.toString();
};

export const getFirstAlphabeticalChar = (label: string) => {
  const match = label.match(/[a-zA-Z]/);
  return match ? match[0].toUpperCase() : 'Other';
};

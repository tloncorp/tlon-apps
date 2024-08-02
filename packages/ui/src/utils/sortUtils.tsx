export const getFirstAlphabeticalChar = (label: string) => {
  const match = label.match(/[a-zA-Z]/);
  return match ? match[0].toUpperCase() : 'Other';
};

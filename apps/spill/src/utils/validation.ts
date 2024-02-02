export const isBoolean = (value: unknown): value is boolean => {
  return typeof value === 'boolean';
};

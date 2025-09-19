export const onlyUnique = (
  value: string | number,
  index: number,
  self: Array<number | string>
): boolean => self.indexOf(value) === index;

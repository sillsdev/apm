export const removeExtension = (
  filename: string
): { name: string; ext: string } => {
  let ext = '';
  const x = filename.split('.');
  if (x.length > 1) ext = x.pop() || '';
  return { name: x.join('.'), ext: ext };
};

export function getUrlNameAndExt(urlString: string) {
  const url = new URL(urlString);
  const pathname = url.pathname; // "/path/to/file.name.ext"
  const filename = pathname.split('/').pop(); // "file.name.ext"

  // if no dot, treat as no extension
  const lastDot = filename?.lastIndexOf('.') ?? -1;
  if (lastDot === -1) {
    return { base: filename ?? '', ext: '' };
  }

  const base = filename?.slice(0, lastDot) || ''; // "file.name"
  const ext = filename?.slice(lastDot + 1) || ''; // "ext" (no leading dot)

  return { base, ext };
}

// example
// const { base, ext } = getFileNameAndExtension(
//   'https://example.com/path/to/photo.jpeg?size=large'
// );
// console.log(base); // "photo"
// console.log(ext);  // "jpeg"

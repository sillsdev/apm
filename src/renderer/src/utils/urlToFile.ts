export async function urlToFile(
  url: string,
  fileName: string,
  mimeType: string
): Promise<File> {
  const res = await fetch(url);
  const buf = await res.arrayBuffer(); // or: const blob = await res.blob();
  return new File([buf], fileName, { type: mimeType });
}

// usage
// (async () => {
//   const file = await urlToFile(
//     'https://example.com/image.png',
//     'image.png',
//     'image/png'
//   );
//   console.log(file instanceof File); // true
// })();

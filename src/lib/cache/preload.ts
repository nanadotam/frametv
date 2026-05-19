export async function preloadPhotos(urls: string[]): Promise<void> {
  const cache = await caches.open('photos');
  await Promise.allSettled(
    urls.map((url) =>
      cache.match(url).then((hit) => {
        if (hit) return;
        return fetch(url).then((res) => {
          if (res.ok) cache.put(url, res.clone());
        });
      })
    )
  );
}

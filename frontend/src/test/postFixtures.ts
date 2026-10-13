// src/test/postFixtures.ts
// Datos y utilidades compartidas por los tests de Momentos.
import type { Post, PostPhoto } from '../lib/api';

export function makePhoto(n = 1, o: Partial<PostPhoto> = {}): PostPhoto {
  return {
    id: `ph-${n}`,
    url: `https://img.test/p${n}.jpg`,
    thumb_url: `https://img.test/t${n}.jpg`,
    width: 1600,
    height: 1200,
    ...o,
  };
}

export function makePost(o: Partial<Post> = {}): Post {
  return {
    id: 'post-1',
    caption: 'Un día increíble',
    created_at: new Date(Date.now() - 5 * 60_000).toISOString(),
    author: { id: 'user-1', name: 'María García', avatar: 'https://img.test/a.png', role: 'volunteer' },
    project: { id: 'proj-1', title: 'Reforestación Urbana' },
    photos: [makePhoto(1)],
    likes_count: 3,
    liked_by_me: false,
    can_delete: false,
    ...o,
  };
}

/** Una promesa que el test resuelve o rechaza a mano (para ver el estado "en vuelo"). */
export function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

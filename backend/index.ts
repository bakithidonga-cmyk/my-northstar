import { router, json, error, secrets } from '@appdeploy/sdk';

type TmdbItem = {
  id: number;
  media_type?: 'movie' | 'tv' | 'person';
  title?: string;
  name?: string;
  release_date?: string;
  first_air_date?: string;
  overview?: string;
  poster_path?: string | null;
  backdrop_path?: string | null;
  vote_average?: number;
  genre_ids?: number[];
};

type TmdbVideo = {
  key: string;
  site: string;
  type: string;
  official?: boolean;
  name?: string;
};

const genreNames: Record<number, string> = {
  12: 'Adventure', 14: 'Fantasy', 16: 'Animation', 18: 'Drama', 27: 'Horror',
  28: 'Action', 35: 'Comedy', 36: 'History', 37: 'Western', 53: 'Thriller',
  80: 'Crime', 878: 'Sci-Fi', 9648: 'Mystery', 10749: 'Romance', 10751: 'Family',
  10759: 'Action & Adventure', 10762: 'Kids', 10763: 'News', 10764: 'Reality',
  10765: 'Sci-Fi & Fantasy', 10766: 'Soap', 10767: 'Talk', 10768: 'War & Politics',
  10770: 'TV Movie', 99: 'Documentary', 10402: 'Music',
};

async function readToken(): Promise<string | null> {
  const names = await secrets.listSecretNames();
  if (!names.includes('TMDB_READ_ACCESS_TOKEN')) return null;
  return secrets.readSecret('TMDB_READ_ACCESS_TOKEN');
}

async function tmdbGet(path: string, token: string): Promise<Response> {
  return fetch('https://api.themoviedb.org/3' + path, {
    headers: { Authorization: 'Bearer ' + token, accept: 'application/json' },
  });
}

export const handler = router({
  'GET /api/catalog': [
    async ({ query }) => {
      const token = await readToken();
      if (!token) return json({ configured: false, results: [] });

      const term = (query.q || '').trim();
      const type = query.type === 'movie' || query.type === 'tv' ? query.type : 'all';
      const route = term ? '/search/multi' : type === 'all' ? '/trending/all/week' : '/trending/' + type + '/week';
      const params = new URLSearchParams({ language: 'en-US' });
      if (term) {
        params.set('query', term);
        params.set('include_adult', 'false');
        params.set('page', '1');
      }

      try {
        const response = await tmdbGet(route + '?' + params.toString(), token);
        if (!response.ok) {
          console.warn('TMDB catalog request returned status ' + response.status);
          return error('The catalog request failed. Check the TMDB token and retry.', 502);
        }
        const payload = await response.json() as { results?: TmdbItem[] };
        const results = (payload.results || [])
          .filter(item => item.media_type !== 'person' && item.id && (item.title || item.name))
          .map(item => {
            const mediaType = item.media_type === 'tv' || type === 'tv' ? 'tv' : 'movie';
            const imagePath = item.backdrop_path || item.poster_path || '';
            return {
              id: mediaType + ':' + item.id,
              tmdbId: item.id,
              mediaType,
              name: item.title || item.name || 'Untitled',
              kind: mediaType,
              year: (item.release_date || item.first_air_date || '').slice(0, 4) || '—',
              rating: typeof item.vote_average === 'number' ? item.vote_average.toFixed(1) : '—',
              synopsis: item.overview || 'No synopsis is available yet.',
              image: imagePath ? 'https://image.tmdb.org/t/p/w780' + imagePath : '',
              accent: item.genre_ids?.map(id => genreNames[id]).find(Boolean) || '',
            };
          });
        return json({ configured: true, results });
      } catch {
        console.warn('TMDB catalog request failed.');
        return error('The movie catalog is temporarily unavailable. Please retry.', 502);
      }
    },
  ],
  'GET /api/videos': [
    async ({ query }) => {
      const token = await readToken();
      if (!token) return json({ configured: false, key: '' });
      const mediaType = query.type === 'tv' ? 'tv' : 'movie';
      const tmdbId = Number(query.id);
      if (!Number.isInteger(tmdbId) || tmdbId <= 0) return error('A valid title ID is required.', 400);

      try {
        const response = await tmdbGet('/' + mediaType + '/' + tmdbId + '/videos?language=en-US', token);
        if (!response.ok) return error('The trailer lookup failed.', 502);
        const payload = await response.json() as { results?: TmdbVideo[] };
        const videos = (payload.results || [])
          .filter(video => video.site === 'YouTube' && video.key && ['Trailer', 'Teaser'].includes(video.type))
          .sort((a, b) => Number(Boolean(b.official)) - Number(Boolean(a.official)));
        return json({ key: videos[0]?.key || '', results: videos });
      } catch {
        console.warn('TMDB trailer lookup failed.');
        return error('The trailer service is temporarily unavailable.', 502);
      }
    },
  ],
});
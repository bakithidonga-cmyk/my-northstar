import { useEffect, useMemo, useState } from 'react';
import { api } from '@appdeploy/client';
import {
  Bell, Check, ChevronDown, ChevronLeft, ChevronRight, CircleUserRound,
  Info, Play, Plus, Search, X,
} from 'lucide-react';

type Title = {
  id: string;
  tmdbId: number;
  mediaType: 'movie' | 'tv';
  name: string;
  kind: string;
  year: string;
  rating: string;
  synopsis: string;
  image: string;
  accent: string;
};

type CatalogResponse = { configured: boolean; results: Title[] };

const sampleVideo = 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4';

function readTitles(key: string): Title[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(key) || '[]');
    return Array.isArray(value) ? value as Title[] : [];
  } catch {
    return [];
  }
}

function readVideoMap(): Record<string, string> {
  try {
    const value: unknown = JSON.parse(localStorage.getItem('northstar-videos') || '{}');
    return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, string> : {};
  } catch {
    return {};
  }
}

function App() {
  const [active, setActive] = useState('Home');
  const [titles, setTitles] = useState<Title[]>([]);
  const [saved, setSaved] = useState<Title[]>(() => readTitles('northstar-saved'));
  const [videoMap, setVideoMap] = useState<Record<string, string>>(readVideoMap);
  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const [loading, setLoading] = useState(true);
  const [configured, setConfigured] = useState(true);
  const [catalogError, setCatalogError] = useState('');
  const [selected, setSelected] = useState<Title | null>(null);
  const [trailerKey, setTrailerKey] = useState('');
  const [trailerLoading, setTrailerLoading] = useState(false);
  const [videoInput, setVideoInput] = useState('');
  const [videoOpen, setVideoOpen] = useState(false);
  const [playerError, setPlayerError] = useState('');
  const [notice, setNotice] = useState('');

  const loadCatalog = async (type = 'all', term = '') => {
    setLoading(true);
    setCatalogError('');
    try {
      const params = new URLSearchParams({ type });
      if (term.trim()) params.set('q', term.trim());
      const response = await api.get('/api/catalog?' + params.toString());
      const data = response.data as CatalogResponse;
      setConfigured(Boolean(data.configured));
      setTitles(Array.isArray(data.results) ? data.results : []);
    } catch {
      setCatalogError('The catalog could not load. Please try again.');
      setTitles([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadCatalog();
  }, []);

  const toggleSaved = (item: Title) => {
    setSaved(current => {
      const next = current.some(title => title.id === item.id)
        ? current.filter(title => title.id !== item.id)
        : [...current, item];
      localStorage.setItem('northstar-saved', JSON.stringify(next));
      return next;
    });
    setNotice(saved.some(title => title.id === item.id) ? 'Removed from My List' : 'Added to My List');
    window.setTimeout(() => setNotice(''), 1800);
  };

  const openTitle = (item: Title) => {
    setSelected(item);
    setTrailerKey('');
    setTrailerLoading(false);
    setVideoInput(videoMap[item.id] || '');
    setVideoOpen(false);
    setPlayerError('');
  };

  const loadTrailer = async (item: Title) => {
    setTrailerLoading(true);
    setPlayerError('');
    try {
      const params = new URLSearchParams({ type: item.mediaType, id: String(item.tmdbId) });
      const response = await api.get('/api/videos?' + params.toString());
      const key = response.data?.key;
      if (typeof key === 'string' && key) setTrailerKey(key);
      else setPlayerError('No playable trailer is listed for this title.');
    } catch {
      setPlayerError('The trailer could not load. You can add a direct video link below.');
    } finally {
      setTrailerLoading(false);
    }
  };

  const changeSection = (section: string) => {
    setActive(section);
    setSearching(false);
    setQuery('');
    if (section === 'Films') void loadCatalog('movie');
    else if (section === 'Series') void loadCatalog('tv');
    else if (section !== 'My List') void loadCatalog('all');
  };

  const submitSearch = () => {
    if (!query.trim()) return;
    setSearching(true);
    void loadCatalog('all', query);
  };

  const saveVideoUrl = () => {
    if (!selected) return;
    try {
      const parsed = new URL(videoInput.trim());
      if (parsed.protocol !== 'https:') throw new Error('HTTPS required');
      const next = { ...videoMap, [selected.id]: parsed.toString() };
      setVideoMap(next);
      localStorage.setItem('northstar-videos', JSON.stringify(next));
      setPlayerError('');
      setNotice('Video link saved on this device');
      window.setTimeout(() => setNotice(''), 1800);
    } catch {
      setPlayerError('Enter a valid HTTPS link to a direct MP4, WebM, or browser-compatible HLS video.');
    }
  };

  const useSampleVideo = () => {
    if (!selected) return;
    const next = { ...videoMap, [selected.id]: sampleVideo };
    setVideoMap(next);
    localStorage.setItem('northstar-videos', JSON.stringify(next));
    setVideoInput(sampleVideo);
    setPlayerError('');
  };

  const startDirectVideo = () => {
    if (!selected) return;
    const savedUrl = videoMap[selected.id];
    if (!savedUrl) {
      setPlayerError('Add a direct video link below, or try the free CC0 sample clip.');
      return;
    }
    setVideoInput(savedUrl);
    setTrailerKey('');
    setVideoOpen(true);
    setPlayerError('');
  };

  const currentTitles = searching ? titles : active === 'My List' ? saved : titles;
  const featured = !searching && active !== 'My List' ? titles[0] : undefined;

  const activeRows = useMemo(() => {
    if (searching) return [{ title: 'Search Results', items: titles }];
    if (active === 'My List') return [{ title: 'My List', items: saved }];
    if (active === 'Films') return [{ title: 'Films to Explore', items: titles.filter(item => item.mediaType === 'movie') }];
    if (active === 'Series') return [{ title: 'Series to Explore', items: titles.filter(item => item.mediaType === 'tv') }];
    return [
      { title: 'Trending Now', items: titles },
      { title: 'Popular Films', items: titles.filter(item => item.mediaType === 'movie') },
      { title: 'Popular Series', items: titles.filter(item => item.mediaType === 'tv') },
    ];
  }, [active, searching, titles, saved]);

  return (
    <div className="app-shell">
      <header className="topbar">
        <button className="brand" onClick={() => changeSection('Home')} aria-label="Northstar home">NORTHSTAR<span>+</span></button>
        <nav className="main-nav" aria-label="Main navigation">
          {['Home', 'Series', 'Films', 'New & Popular', 'My List'].map(item => (
            <button key={item} className={active === item ? 'nav-link active' : 'nav-link'} onClick={() => changeSection(item)}>{item}</button>
          ))}
        </nav>
        <div className="header-actions">
          <div className={searchOpen ? 'search-box open' : 'search-box'}>
            <button aria-label="Search titles" onClick={() => setSearchOpen(true)}><Search size={19} /></button>            {searchOpen && <input autoFocus value={query} onChange={event => setQuery(event.target.value)}
              onKeyDown={event => event.key === 'Enter' && submitSearch()} placeholder="Titles, people" />}
            {searchOpen && <button aria-label="Search" onClick={submitSearch}><ChevronRight size={17} /></button>}
            {searchOpen && <button aria-label="Close search" onClick={() => { setSearchOpen(false); setQuery(''); setSearching(false); void loadCatalog(); }}><X size={17} /></button>}
          </div>
          <button className="icon-button" aria-label="Notifications"><Bell size={19} /></button>
          <button className="profile" aria-label="Profile"><span className="avatar"><CircleUserRound size={21} /></span><ChevronDown size={14} /></button>
        </div>
      </header>

      <main>
        {featured && <section className="hero" aria-label="Featured title">
          <div className="hero-image" style={featured.image ? { backgroundImage: 'url("' + featured.image + '")' } : undefined} />
          <div className="hero-shade" />
          <div className="hero-content">
            <div className="eyebrow"><span className="star-mark">✦</span> NORTHSTAR FEATURED</div>
            <div className="hero-title"><span className="title-kicker">DISCOVER SOMETHING NEW</span><h1>{featured.name}</h1></div>
            <p className="hero-copy">{featured.kind === 'movie' ? 'A film to discover.' : 'A series to discover.'}</p>
            <p className="hero-description">{featured.synopsis}</p>
            <div className="hero-meta"><span className="match">TMDB {featured.rating}</span><span>{featured.year}</span><span className="rating">{featured.kind}</span><span className="ultra">4K</span></div>
            <div className="hero-buttons">
              <button className="play-button" onClick={() => { openTitle(featured); void loadTrailer(featured); }}><Play size={20} fill="currentColor" /> Play Trailer</button>
              <button className="more-button" onClick={() => openTitle(featured)}><Info size={20} /> More Info</button>
            </div>
          </div>
          <div className="hero-caption"><span>LIVE CATALOG</span><b>Powered by TMDB</b></div>
          <div className="hero-progress"><span /></div>
        </section>}

        {catalogError && <div className="catalog-error" role="alert">{catalogError}<button onClick={() => void loadCatalog()}>Retry</button></div>}
        {!configured && <div className="catalog-error" role="status">TMDb is not connected yet. Add the API Read Access Token in AppDeploy secrets.</div>}

        {(searchOpen && searching) || active === 'My List' ? (
          <section className="search-results">
            <h2>{active === 'My List' ? 'My List' : 'Results for “' + query + '”'}</h2>
            {loading ? <p className="empty-state">Finding titles…</p> : currentTitles.length ? (
              <div className="search-grid">{currentTitles.map(item => <Poster key={item.id} item={item}
                saved={saved.some(title => title.id === item.id)} onOpen={openTitle} onSave={toggleSaved} />)}</div>
            ) : <p className="empty-state">{active === 'My List' ? 'Your list is ready for its first title. Browse and tap + to save something for later.' : 'No titles found. Try another title.'}</p>}
          </section>
        ) : (
          <div className="browse-content">
            {activeRows.map(row => <section className="title-row" key={row.title}>
              <div className="row-heading"><h2>{row.title}</h2><button aria-label={'Browse ' + row.title}>Explore all <ChevronRight size={16} /></button></div>
              {loading ? <p className="empty-state">Loading titles…</p> : row.items.length ? (
                <div className="poster-track">
                  <button className="scroll-control left" aria-label="Scroll left" onClick={event => event.currentTarget.parentElement?.querySelector('.poster-list')?.scrollBy({ left: -620, behavior: 'smooth' })}><ChevronLeft /></button>
                  <div className="poster-list">{row.items.map(item => <Poster key={item.id} item={item}
                    saved={saved.some(title => title.id === item.id)} onOpen={openTitle} onSave={toggleSaved} />)}</div>
                  <button className="scroll-control right" aria-label="Scroll right" onClick={event => event.currentTarget.parentElement?.querySelector('.poster-list')?.scrollBy({ left: 620, behavior: 'smooth' })}><ChevronRight /></button>
                </div>
              ) : <p className="empty-state">No titles in this row right now.</p>}
            </section>)}
            <section className="membership-banner"><div><span className="eyebrow">YOUR NEXT FAVORITE IS HERE</span><h2>Stories worth staying in for.</h2><p>Catalog details and trailers from TMDB.</p></div><button onClick={() => changeSection('New & Popular')}>Explore titles <ChevronRight size={17} /></button></section>
            <section className="credits" aria-label="Credits">
              <h2>Credits</h2>
              <a href="https://www.themoviedb.org/" target="_blank" rel="noreferrer" className="tmdb-logo-link">
                <img src="https://www.themoviedb.org/assets/2/v4/logos/v2/blue_short-8e7b30f73a4020692ccca9c88bafe5dcb6f8a62a4c6bc55cd9ba82bb2cd95f6c.svg" alt="The Movie Database (TMDB)" />
              </a>
              <p>This product uses the TMDB API but is not endorsed or certified by TMDB.</p>
              <p>TMDB provides catalog details and trailers, not full movie streams.</p>
            </section>
            <footer><span>Questions? Visit our Help Center</span><span>© 2025 Northstar</span></footer>
          </div>
        )}
      </main>

      {notice && <div className="toast"><Check size={17} />{notice}</div>}
      {selected && <div className="modal-backdrop" onClick={() => setSelected(null)}>
        <div className="detail-modal" role="dialog" aria-modal="true" aria-label={selected.name} onClick={event => event.stopPropagation()}>
          <button className="modal-close" aria-label="Close details" onClick={() => setSelected(null)}><X /></button>
          <div className="modal-art" style={{ backgroundImage: 'linear-gradient(0deg, #141414 0%, transparent 68%), url("' + selected.image + '")' }}>
            <div className="modal-title"><span className="eyebrow">TMDB CATALOG</span><h2>{selected.name}</h2>
              <button className="play-button small" onClick={() => void loadTrailer(selected)} disabled={trailerLoading}>
                <Play size={17} fill="currentColor" /> {trailerLoading ? 'Loading…' : 'Play Trailer'}
              </button>
            </div>
          </div>
          <div className="modal-info"><div><div className="hero-meta"><span className="match">TMDB {selected.rating}</span><span>{selected.year}</span><span className="rating">{selected.kind}</span></div><p>{selected.synopsis}</p></div>
            <button className="save-button" onClick={() => toggleSaved(selected)} aria-label={saved.some(title => title.id === selected.id) ? 'Remove from My List' : 'Add to My List'}>
              {saved.some(title => title.id === selected.id) ? <Check /> : <Plus />}
            </button>
          </div>
          {(trailerKey || videoOpen) && <div className="video-player-wrap">
            {trailerKey && <iframe title={selected.name + ' trailer'} src={'https://www.youtube-nocookie.com/embed/' + encodeURIComponent(trailerKey) + '?autoplay=1'}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen />}
            {videoOpen && <video key={videoMap[selected.id]} controls playsInline preload="metadata" src={videoMap[selected.id]}
              onError={() => setPlayerError('This link could not be played. Use a direct video file URL and check that its host allows playback.')} />}
          </div>}
          <div className="video-setup">
            <label htmlFor="video-url">Play a video you’re authorized to stream</label>
            <p>Paste a direct HTTPS MP4 or WebM link. HLS links work in browsers with native HLS support.</p>
            <div className="video-url-row">
              <input id="video-url" type="url" value={videoInput} onChange={event => setVideoInput(event.target.value)} placeholder="https://example.com/video.mp4" />
              <button onClick={saveVideoUrl}>Save link</button>
              <button className="sample-button" onClick={useSampleVideo}>Use CC0 sample</button>
              <button className="sample-button" onClick={startDirectVideo}>Play my video</button>
            </div>
            <a className="sample-credit" href="https://developer.mozilla.org/en-US/docs/Web/HTML/Element/video" target="_blank" rel="noreferrer">CC0 flower video sample from MDN</a>
            {playerError && <p className="player-error" role="alert">{playerError}</p>}
          </div>
        </div>
      </div>}
    </div>
  );
}

function Poster({ item, saved, onOpen, onSave }: {
  item: Title;
  saved: boolean;
  onOpen: (item: Title) => void;
  onSave: (item: Title) => void;
}) {
  return <article className="poster-card">
    <button className="poster-art" onClick={() => onOpen(item)}
      style={{ backgroundImage: 'linear-gradient(0deg, rgba(0,0,0,.84), transparent 58%), url("' + item.image + '")' }}
      aria-label={'View ' + item.name}>
      <span className="poster-brand">N<span>+</span></span>
      <span className="poster-caption"><small>{item.kind}</small><b>{item.name}</b></span>
    </button>
    <div className="poster-info"><div><strong>{item.name}</strong><span>{item.year} <i>{item.rating}</i></span></div>
      <button className={saved ? 'save-mini saved' : 'save-mini'} aria-label={saved ? 'Remove ' + item.name + ' from My List' : 'Add ' + item.name + ' to My List'} onClick={() => onSave(item)}>
        {saved ? <Check size={17} /> : <Plus size={17} />}
      </button>
    </div>
    <p className="poster-synopsis">{item.synopsis}</p>
  </article>;
}

export default App;
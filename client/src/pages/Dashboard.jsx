import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Brand from '../components/Brand.jsx';
import {
  getMe, listCapsules, createCapsule, updateCapsule, deleteCapsule, logout,
} from '../api.js';

const BLANK = {
  project_name: '', prompt_title: '', prompt_version: 'v1', prompt_text: '',
  response_summary: '', category: 'Coding', usefulness: 'Good',
  reviewed: false, improved: false, screenshot_url: '', notes: '',
};

const CATEGORIES = ['Coding', 'Writing', 'Research'];
const USEFULNESS = [
  { value: 'Good', label: 'Good' },
  { value: 'Needs Improvement', label: 'Needs improvement' },
];

const isWebLink = (url) => /^https?:\/\//i.test(url || '');

function formatDate(value) {
  if (!value) return '';
  const d = new Date(value.includes('T') ? value : value.replace(' ', 'T') + 'Z');
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [capsules, setCapsules] = useState([]);
  const [form, setForm] = useState(BLANK);
  const [editingId, setEditingId] = useState(null);
  const [freshId, setFreshId] = useState(null);
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const me = await getMe();
        setUser(me.user);
        setCapsules(await listCapsules());
      } catch (err) {
        if (err.status === 401) return navigate('/login');
        setError(err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [navigate]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return capsules;
    return capsules.filter((c) =>
      [c.prompt_title, c.project_name, c.prompt_text, c.response_summary, c.notes, c.category]
        .some((field) => (field || '').toLowerCase().includes(q))
    );
  }, [capsules, query]);

  const reviewedCount = capsules.filter((c) => c.reviewed).length;

  const change = (e) => {
    const { name, type, value, checked } = e.target;
    setForm((f) => ({ ...f, [name]: type === 'checkbox' ? checked : value }));
  };

  const reset = () => { setForm(BLANK); setEditingId(null); setError(''); };

  function flash(id) {
    setFreshId(id);
    setTimeout(() => setFreshId((current) => (current === id ? null : current)), 1800);
  }

  async function submit(e) {
    e.preventDefault();
    setError('');

    if (!form.project_name.trim() || !form.prompt_title.trim() || !form.prompt_text.trim()) {
      setError('Add a project name, a prompt title and the prompt text before saving.');
      return;
    }

    setSaving(true);
    try {
      if (editingId) {
        const updated = await updateCapsule(editingId, form);
        setCapsules((list) => list.map((c) => (c.id === editingId ? updated : c)));
        flash(updated.id);
      } else {
        const created = await createCapsule(form);
        setCapsules((list) => [created, ...list]);
        flash(created.id);
      }
      reset();
    } catch (err) {
      if (err.status === 401) return navigate('/login');
      setError(`Could not save the capsule: ${err.message}`);
    } finally {
      setSaving(false);
    }
  }

  function startEdit(c) {
    setEditingId(c.id);
    setError('');
    setForm({
      ...BLANK,
      ...Object.fromEntries(Object.keys(BLANK).map((k) => [k, c[k] ?? BLANK[k]])),
      reviewed: !!c.reviewed,
      improved: !!c.improved,
    });
    document.getElementById('capsule-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  async function remove(c) {
    if (!confirm(`Delete "${c.prompt_title}"? This cannot be undone.`)) return;
    try {
      await deleteCapsule(c.id);
      setCapsules((list) => list.filter((x) => x.id !== c.id));
      if (editingId === c.id) reset();
    } catch (err) {
      if (err.status === 401) return navigate('/login');
      setError(`Could not delete the capsule: ${err.message}`);
    }
  }

  async function signOut() {
    await logout().catch(() => {});
    navigate('/login');
  }

  if (loading) {
    return <div className="site site-center"><p className="loading">Loading your capsules…</p></div>;
  }

  return (
    <div className="site">
      <header className="site-bar">
        <Brand to="/dashboard" />
        <div className="who">
          <span>Signed in as <strong>{user?.username}</strong></span>
          <button className="btn btn-quiet" onClick={signOut}>Sign out</button>
        </div>
      </header>

      <main className="desk">
        <section className="panel" id="capsule-form" aria-labelledby="form-title">
          <div className="panel-head">
            <h2 id="form-title">{editingId ? 'Edit capsule' : 'New capsule'}</h2>
            {editingId && <button className="link" type="button" onClick={reset}>Cancel</button>}
          </div>

          {error && <p className="alert" role="alert">{error}</p>}

          <form onSubmit={submit} noValidate>
            <fieldset>
              <label className="field">
                <span>Prompt title</span>
                <input name="prompt_title" value={form.prompt_title} onChange={change} />
              </label>
              <label className="field">
                <span>Prompt text</span>
                <textarea name="prompt_text" rows="4" className="serif" value={form.prompt_text}
                  onChange={change} />
              </label>
            </fieldset>

            <fieldset>
              <div className="row">
                <label className="field grow">
                  <span>Project name</span>
                  <input name="project_name" value={form.project_name} onChange={change} />
                </label>
                <label className="field narrow">
                  <span>Version</span>
                  <input name="prompt_version" value={form.prompt_version} onChange={change}
                    placeholder="v1" />
                </label>
              </div>
              <div className="field">
                <span id="cat-label">Category</span>
                <div className="seg" role="radiogroup" aria-labelledby="cat-label">
                  {CATEGORIES.map((c) => (
                    <label key={c} className={form.category === c ? 'on' : ''}>
                      <input type="radio" name="category" value={c}
                        checked={form.category === c} onChange={change} />
                      {c}
                    </label>
                  ))}
                </div>
              </div>
            </fieldset>

            <fieldset>
              <label className="field">
                <span>Response summary</span>
                <textarea name="response_summary" rows="2" value={form.response_summary}
                  onChange={change} />
              </label>
              <div className="field">
                <span id="use-label">Usefulness</span>
                <div className="seg" role="radiogroup" aria-labelledby="use-label">
                  {USEFULNESS.map((u) => (
                    <label key={u.value} className={form.usefulness === u.value ? 'on' : ''}>
                      <input type="radio" name="usefulness" value={u.value}
                        checked={form.usefulness === u.value} onChange={change} />
                      {u.label}
                    </label>
                  ))}
                </div>
              </div>
              <div className="toggles">
                <label className="toggle">
                  <input type="checkbox" name="reviewed" checked={form.reviewed} onChange={change} />
                  <span>Reviewed</span>
                </label>
                <label className="toggle">
                  <input type="checkbox" name="improved" checked={form.improved} onChange={change} />
                  <span>Improved</span>
                </label>
              </div>
              <label className="field">
                <span>Screenshot link <em>optional</em></span>
                <input name="screenshot_url" value={form.screenshot_url} onChange={change}
                  placeholder="https://" inputMode="url" />
              </label>
              <label className="field">
                <span>Notes <em>optional</em></span>
                <textarea name="notes" rows="2" value={form.notes} onChange={change} />
              </label>
            </fieldset>

            <button className="btn btn-primary btn-block" type="submit" disabled={saving}>
              {saving ? 'Saving…' : editingId ? 'Save changes' : 'Create capsule'}
            </button>
          </form>
        </section>

        <section className="shelf" aria-labelledby="shelf-title">
          <div className="shelf-head">
            <div>
              <h2 id="shelf-title">Your capsules</h2>
              <p className="shelf-count">
                {capsules.length} saved, {reviewedCount} reviewed
              </p>
            </div>
            {capsules.length > 0 && (
              <label className="search">
                <span className="sr">Search your capsules</span>
                <input type="search" value={query} onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search your capsules" />
              </label>
            )}
          </div>

          {capsules.length === 0 && (
            <div className="empty">
              <h3>No capsules yet</h3>
              <p>Use the form to save your first prompt.</p>
            </div>
          )}

          {capsules.length > 0 && visible.length === 0 && (
            <div className="empty">
              <h3>Nothing matches “{query}”</h3>
              <p>Try a different word, or <button className="link" onClick={() => setQuery('')}>
                clear the search</button>.</p>
            </div>
          )}

          <div className="capsules">
            {visible.map((c) => (
              <article key={c.id}
                className={`capsule${editingId === c.id ? ' is-editing' : ''}${freshId === c.id ? ' is-fresh' : ''}`}>
                <div className="capsule-ver">{c.prompt_version || 'v1'}</div>
                <div className="capsule-body">
                  <header className="capsule-head">
                    <div>
                      <h3>{c.prompt_title}</h3>
                      <p className="capsule-where">
                        <span>{c.project_name}</span>
                        {c.category && <span>{c.category}</span>}
                      </p>
                    </div>
                    {c.usefulness && (
                      <span className={`pill ${c.usefulness === 'Good' ? 'pill-good' : 'pill-meh'}`}>
                        {c.usefulness === 'Good' ? 'Good' : 'Needs improvement'}
                      </span>
                    )}
                  </header>

                  <blockquote className="capsule-prompt">{c.prompt_text}</blockquote>

                  {c.response_summary && (
                    <p className="capsule-resp"><span className="k">AI response</span>{c.response_summary}</p>
                  )}
                  {c.notes && (
                    <p className="capsule-resp"><span className="k">Notes</span>{c.notes}</p>
                  )}

                  <footer className="capsule-foot">
                    <ul className="marks">
                      <li className={c.reviewed ? 'yes' : 'no'}>{c.reviewed ? 'Reviewed' : 'Not reviewed'}</li>
                      <li className={c.improved ? 'yes' : 'no'}>{c.improved ? 'Improved' : 'Not improved'}</li>
                      {isWebLink(c.screenshot_url) && (
                        <li><a href={c.screenshot_url} target="_blank" rel="noopener noreferrer">Screenshot</a></li>
                      )}
                    </ul>
                    <div className="capsule-actions">
                      <time dateTime={c.created_at}>{formatDate(c.created_at)}</time>
                      <button className="link" onClick={() => startEdit(c)}>Edit</button>
                      <button className="link link-danger" onClick={() => remove(c)}>Delete</button>
                    </div>
                  </footer>
                </div>
              </article>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}

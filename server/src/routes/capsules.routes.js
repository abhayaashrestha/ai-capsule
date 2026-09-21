import express from 'express';
import db from '../db.js';
import { requireAuth } from '../auth.js';

const router = express.Router();

const toFlag = (v) => (v === true || v === 1 || v === '1' || v === 'true' ? 1 : 0);

function validate(body) {
  const errors = [];
  if (!body.project_name?.trim()) errors.push('project_name is required');
  if (!body.prompt_title?.trim()) errors.push('prompt_title is required');
  if (!body.prompt_text?.trim()) errors.push('prompt_text is required');
  return errors;
}

router.get('/', requireAuth, (req, res) => {
  const rows = db
    .prepare('SELECT * FROM capsules WHERE user_id = ? ORDER BY id DESC')
    .all(req.user.id);
  res.json(rows);
});

router.post('/', requireAuth, (req, res) => {
  const errors = validate(req.body);
  if (errors.length) return res.status(400).json({ error: errors.join(', ') });

  const info = db
    .prepare(`
      INSERT INTO capsules (
        user_id, project_name, prompt_title, prompt_version, prompt_text,
        response_summary, category, usefulness, reviewed, improved,
        screenshot_url, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    .run(
      req.user.id,
      req.body.project_name.trim(),
      req.body.prompt_title.trim(),
      req.body.prompt_version ?? '',
      req.body.prompt_text.trim(),
      req.body.response_summary ?? '',
      req.body.category ?? '',
      req.body.usefulness ?? '',
      toFlag(req.body.reviewed),
      toFlag(req.body.improved),
      req.body.screenshot_url ?? '',
      req.body.notes ?? ''
    );

  const created = db
    .prepare('SELECT * FROM capsules WHERE id = ? AND user_id = ?')
    .get(info.lastInsertRowid, req.user.id);

  res.status(201).json(created);
});

router.put('/:id', requireAuth, (req, res) => {
  const errors = validate(req.body);
  if (errors.length) return res.status(400).json({ error: errors.join(', ') });

  const info = db
    .prepare(`
      UPDATE capsules SET
        project_name = ?, prompt_title = ?, prompt_version = ?, prompt_text = ?,
        response_summary = ?, category = ?, usefulness = ?, reviewed = ?,
        improved = ?, screenshot_url = ?, notes = ?
      WHERE id = ? AND user_id = ?
    `)
    .run(
      req.body.project_name.trim(),
      req.body.prompt_title.trim(),
      req.body.prompt_version ?? '',
      req.body.prompt_text.trim(),
      req.body.response_summary ?? '',
      req.body.category ?? '',
      req.body.usefulness ?? '',
      toFlag(req.body.reviewed),
      toFlag(req.body.improved),
      req.body.screenshot_url ?? '',
      req.body.notes ?? '',
      req.params.id,
      req.user.id
    );

  if (info.changes === 0) {
    return res.status(404).json({ error: 'Capsule not found' });
  }

  const updated = db
    .prepare('SELECT * FROM capsules WHERE id = ? AND user_id = ?')
    .get(req.params.id, req.user.id);

  res.json(updated);
});

router.delete('/:id', requireAuth, (req, res) => {
  const info = db
    .prepare('DELETE FROM capsules WHERE id = ? AND user_id = ?')
    .run(req.params.id, req.user.id);

  if (info.changes === 0) {
    return res.status(404).json({ error: 'Capsule not found' });
  }

  res.json({ ok: true, id: Number(req.params.id) });
});

export default router;

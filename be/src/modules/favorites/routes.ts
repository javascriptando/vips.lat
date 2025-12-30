import { Hono } from 'hono';
import type { AppVariables } from '@/types';
import { requireAuth } from '@/middlewares/auth';
import * as favoriteService from './service';

const favoriteRoutes = new Hono<{ Variables: AppVariables }>();

// === FAVORITOS (Criadores) ===

// GET /api/favorites/creators - Listar criadores favoritos
favoriteRoutes.get('/creators', requireAuth, async (c) => {
  const user = c.get('user')!;
  const page = Number(c.req.query('page')) || 1;
  const pageSize = Math.min(Number(c.req.query('pageSize')) || 20, 50);

  const result = await favoriteService.listFavoriteCreators(user.id, page, pageSize);
  return c.json(result);
});

// POST /api/favorites/creators/:creatorId - Toggle favorito
favoriteRoutes.post('/creators/:creatorId', requireAuth, async (c) => {
  const user = c.get('user')!;
  const creatorId = c.req.param('creatorId');

  const result = await favoriteService.toggleFavorite(user.id, creatorId);
  return c.json(result);
});

// GET /api/favorites/creators/:creatorId/status - Verificar se é favorito
favoriteRoutes.get('/creators/:creatorId/status', requireAuth, async (c) => {
  const user = c.get('user')!;
  const creatorId = c.req.param('creatorId');

  const favorited = await favoriteService.isFavorited(user.id, creatorId);
  return c.json({ favorited });
});

// === BOOKMARKS (Conteúdos) ===

// GET /api/favorites/bookmarks - Listar conteúdos salvos
favoriteRoutes.get('/bookmarks', requireAuth, async (c) => {
  const user = c.get('user')!;
  const page = Number(c.req.query('page')) || 1;
  const pageSize = Math.min(Number(c.req.query('pageSize')) || 20, 50);

  const result = await favoriteService.listBookmarkedContent(user.id, page, pageSize);
  return c.json(result);
});

// POST /api/favorites/bookmarks/:contentId - Toggle bookmark
favoriteRoutes.post('/bookmarks/:contentId', requireAuth, async (c) => {
  const user = c.get('user')!;
  const contentId = c.req.param('contentId');

  const result = await favoriteService.toggleBookmark(user.id, contentId);
  return c.json(result);
});

// GET /api/favorites/bookmarks/:contentId/status - Verificar se está salvo
favoriteRoutes.get('/bookmarks/:contentId/status', requireAuth, async (c) => {
  const user = c.get('user')!;
  const contentId = c.req.param('contentId');

  const bookmarked = await favoriteService.isBookmarked(user.id, contentId);
  return c.json({ bookmarked });
});

export { favoriteRoutes };

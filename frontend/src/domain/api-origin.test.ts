import { describe, expect, it, vi } from 'vitest';
import { apiFetch, apiURL } from './api-origin';

describe('public API origin',()=>{
 it('uses same-origin routes in local development and an absolute backend origin in deployment',()=>{
  expect(apiURL('/api/v1/workouts','')).toBe('/api/v1/workouts');
  expect(apiURL('/api/v1/workouts','https://gymbro-backend.spmbbanjarkab.web.id/')).toBe('https://gymbro-backend.spmbbanjarkab.web.id/api/v1/workouts');
 });
 it('sends session cookies and CSRF headers on cross-origin requests',async()=>{
  const fetchMock=vi.spyOn(globalThis,'fetch').mockResolvedValue(new Response('{}'));
  await apiFetch('/api/v1/auth/me',{cache:'no-store'},'https://api.example');
  expect(fetchMock).toHaveBeenCalledWith('https://api.example/api/v1/auth/me',expect.objectContaining({credentials:'include',cache:'no-store'}));
  fetchMock.mockRestore();
 });
});

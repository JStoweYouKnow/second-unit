import test from 'node:test'
import assert from 'node:assert/strict'
import {
  roleFilterTags,
  collectRoleFilterOptions,
  artistMatchesRoleFilter,
  artistSelectLabel,
} from '../src/lib/roleFilters.js'

test('long comma-separated headline collapses to first segment', () => {
  const role =
    'Founder, Thought Leader, Creative Technologist, Former Studio Head at Luma AI'
  assert.deepEqual(roleFilterTags(role), ['Founder'])
})

test('short comma-separated titles become separate tags', () => {
  assert.deepEqual(roleFilterTags('Director, VFX Artist'), ['Director', 'VFX Artist'])
})

test('collectRoleFilterOptions dedupes normalized tags', () => {
  const options = collectRoleFilterOptions([
    { role: 'Artist' },
    { role: 'Founder, Thought Leader, Creative Technologist, Former Studio Head at Luma AI' },
  ])
  assert.deepEqual(options, ['Artist', 'Founder'])
})

test('artistMatchesRoleFilter matches normalized tags', () => {
  const selected = new Set(['Founder'])
  const role =
    'Founder, Thought Leader, Creative Technologist, Former Studio Head at Luma AI'
  assert.equal(artistMatchesRoleFilter(role, selected), true)
  assert.equal(artistMatchesRoleFilter('Artist', selected), false)
})

test('artistSelectLabel shows display name only', () => {
  const artist = {
    name: 'Verena Puhm',
    role: 'Founder, Thought Leader, Creative Technologist, Former Studio Head at Luma AI',
  }
  assert.equal(artistSelectLabel(artist), 'Verena Puhm')
})

test('artistSelectLabel falls back for missing name', () => {
  assert.equal(artistSelectLabel({ role: 'Artist' }), 'Artist')
})

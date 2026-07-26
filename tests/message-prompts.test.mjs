import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  getMessagePrompts,
  ARTIST_MESSAGE_PROMPTS,
  CLIENT_MESSAGE_PROMPTS,
} from '../src/lib/messagePrompts.js'

test('getMessagePrompts returns artist prompts for artist viewer', () => {
  assert.deepEqual(getMessagePrompts(true), ARTIST_MESSAGE_PROMPTS)
})

test('getMessagePrompts returns client prompts for hirer viewer', () => {
  assert.deepEqual(getMessagePrompts(false), CLIENT_MESSAGE_PROMPTS)
})

test('prompts include id, label, and text', () => {
  for (const prompt of [...ARTIST_MESSAGE_PROMPTS, ...CLIENT_MESSAGE_PROMPTS]) {
    assert.ok(prompt.id)
    assert.ok(prompt.label)
    assert.ok(prompt.text.endsWith('?') || prompt.text.endsWith('.'))
  }
})

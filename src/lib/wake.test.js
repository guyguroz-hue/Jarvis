import test from 'node:test'
import assert from 'node:assert/strict'
import { extractCommand } from './wake.js'

test('ignores speech without the wake word', () => {
  const r = extractCommand('what time does the train leave')
  assert.equal(r.matched, false)
  assert.equal(r.command, '')
})

test('extracts the command after the wake word', () => {
  const r = extractCommand('Jarvis, what is the weather')
  assert.equal(r.matched, true)
  assert.equal(r.command, 'what is the weather')
})

test('is case-insensitive but preserves the command casing', () => {
  assert.equal(extractCommand('JARVIS open the Bay Doors').command, 'open the Bay Doors')
})

test('matches Hebrew transliterations', () => {
  for (const phrase of ["ג'ארוויס מה השעה", 'גארוויס מה השעה', "ג'רוויס מה השעה"]) {
    const r = extractCommand(phrase)
    assert.equal(r.matched, true, `failed on ${phrase}`)
    assert.equal(r.command, 'מה השעה')
  }
})

test('a bare wake word matches with an empty command', () => {
  const r = extractCommand('Jarvis')
  assert.equal(r.matched, true)
  assert.equal(r.command, '')
})

test('strips punctuation between the wake word and the command', () => {
  assert.equal(extractCommand('jarvis... status report').command, 'status report')
  assert.equal(extractCommand('jarvis — status report').command, 'status report')
})

test('uses the earliest occurrence so the rest of the sentence survives', () => {
  const r = extractCommand('jarvis what does jarvis mean')
  assert.equal(r.command, 'what does jarvis mean')
})

test('handles the wake word mid-sentence', () => {
  assert.equal(extractCommand('okay jarvis dim the lights').command, 'dim the lights')
})

test('rejects non-string and empty input without throwing', () => {
  for (const bad of [null, undefined, 42, '', '   ']) {
    assert.equal(extractCommand(bad).matched, false)
  }
})

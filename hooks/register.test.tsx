import { expect, test } from 'claude-code/testing'
import { formatDuration } from './register.js'

const base = { plugin: 'terminal-gui', component: 'ToolUse', surface: 'terminal' } as const

test('a running tool shows the running label, a finished one done', async ($) => {
  const props = { tool_use_id: 't1', tool: 'Bash', input: {}, isErrored: false, isInterrupted: false }

  const run = await $.ui.mount({ ...base, requestId: 't1', props: { ...props, isRunning: true } })
  expect(await run.find({ type: 'Text', text: /running/ })).toBeTruthy()
  await run.unmount()

  const done = await $.ui.mount({ ...base, requestId: 't1', props: { ...props, isRunning: false } })
  expect(await done.find({ type: 'Text', text: /done/ })).toBeTruthy()
  await done.unmount()
})

test('a typed prompt gets the You bubble', async ($) => {
  const typed = await $.ui.mount({
    plugin: 'terminal-gui', component: 'UserMessage', surface: 'terminal', requestId: 'u1',
    props: { text: 'hi', origin: { kind: 'composer' }, isExpanded: false },
  })
  expect(await typed.find({ type: 'Text', text: /^You$/ })).toBeTruthy()
  await typed.unmount()
})

test('a task notification gets its own card, not the You bubble', async ($) => {
  const note = await $.ui.mount({
    plugin: 'terminal-gui', component: 'UserMessage', surface: 'terminal', requestId: 'n1',
    props: { text: 'done', origin: { kind: 'task-notification' }, isExpanded: false, task: { id: 'a1' } } as never,
  })
  expect(await note.find({ type: 'Text', text: /task/ })).toBeTruthy()
  expect(await note.find({ type: 'Text', text: /^You$/ })).toBeFalsy()
  await note.unmount()
})

test('turn duration reads like the engine', async () => {
  expect(formatDuration(3000)).toBe('3s')
  expect(formatDuration(64000)).toBe('1m 4s')
})

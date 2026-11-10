import { expect, test } from 'claude-code/testing'

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

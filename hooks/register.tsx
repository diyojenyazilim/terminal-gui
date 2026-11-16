import type { Register } from 'claude-code'

type Status = 'running' | 'done' | 'error'

// Status shows in the label color; the border color names the row's kind and never changes.
const LOOK = {
  running: { color: 'yellow', label: '⏳ running' },
  done: { color: 'green', label: '✓ done' },
  error: { color: 'red', label: '✗ failed' },
} as const

// One fixed color per kind, so a card is recognizable at a glance.
const KIND = {
  user: 'magenta',
  assistant: 'cyan',
  tool: 'yellow',
  toolGroup: 'yellowBright',
  agent: 'blue',
  result: 'green',
  command: 'whiteBright',
  question: 'magentaBright',
  notification: 'blueBright',
  message: 'cyanBright',
  info: 'gray',
} as const

// Outer cards use the heavy line set (┏━┓).
const CARD = { borderStyle: 'bold', paddingX: 1, flexDirection: 'column' } as const

const statusOf = (c: { isRunning: boolean; isErrored: boolean; isInterrupted?: boolean }): Status =>
  c.isErrored || c.isInterrupted ? 'error' : c.isRunning ? 'running' : 'done'

// Agent calls are the 'Agent' tool; 'Task' is its older name.
const isAgent = (tool: string) => tool === 'Agent' || tool === 'Task'

export const register: Register = on => {
  // Terminal only: other surfaces keep the engine's own drawing.
  // Expanded rows (ctrl+o, --verbose) stay untouched so the full detail shows.
  on('ui.render', { component: 'ToolUse' }, async ($, e, next) => {
    if (e.surface !== 'terminal' || e.props.isExpanded) return next(e)

    const { Box, Text } = $.ui.resolve(e)
    const { tool, input, isRunning, isErrored, isInterrupted } = e.props
    const look = LOOK[statusOf({ isRunning, isErrored, isInterrupted })]
    const agent = isAgent(tool)
    const color = agent ? KIND.agent : KIND.tool
    const desc = agent ? (input as { description?: string; subagent_type?: string }) : undefined
    const title = agent ? `🤖 ${desc?.subagent_type ?? 'agent'}${desc?.description ? `: ${desc.description}` : ''}` : `🔧 ${tool}`

    return (
      <Box {...CARD} borderColor={color}>
        <Text wrap="truncate-end">
          <Text color={color} bold>{title}</Text>
          <Text color={look.color} bold> · {look.label}</Text>
        </Text>
        {await next(e)}
      </Box>
    )
  })

  on('ui.render', { component: 'ToolResult' }, async ($, e, next) => {
    if (e.surface !== 'terminal' || e.props.isExpanded) return next(e)

    const { Box, Text } = $.ui.resolve(e)

    return (
      <Box flexDirection="column" borderStyle="single" borderColor={KIND.result} borderDimColor paddingX={1}>
        {e.props.isErrored ? <Text color={LOOK.error.color} bold>{LOOK.error.label}</Text> : null}
        {await next(e)}
      </Box>
    )
  })

  on('ui.render', { component: 'ToolGroup' }, async ($, e, next) => {
    if (e.surface !== 'terminal' || e.props.isExpanded) return next(e)

    const { Box, Text } = $.ui.resolve(e)
    const { calls, isActive } = e.props
    const status: Status = calls.some(c => c.isErrored || c.isInterrupted)
      ? 'error'
      : isActive && calls.some(c => c.isRunning)
        ? 'running'
        : 'done'
    const look = LOOK[status]

    return (
      <Box {...CARD} borderColor={KIND.toolGroup}>
        <Text>
          <Text color={KIND.toolGroup} bold>🧰 {calls.length} tool calls</Text>
          <Text color={look.color} bold> · {look.label}</Text>
        </Text>
        {await next(e)}
      </Box>
    )
  })

  on('ui.render', { component: 'AssistantMessage' }, async ($, e, next) => {
    if (e.surface !== 'terminal') return next(e)

    const { Box, Text } = $.ui.resolve(e)

    return (
      <Box {...CARD} borderColor={KIND.assistant}>
        {e.props.isFirstOfReply ? <Text color={KIND.assistant} bold>Claude</Text> : null}
        {await next(e)}
      </Box>
    )
  })

  // Typed prompts, task notifications and peer messages each get their own card color.
  on('ui.render', { component: 'UserMessage' }, async ($, e, next) => {
    if (e.surface !== 'terminal') return next(e)

    const { origin, task, from } = e.props
    const kind = origin.kind === 'composer'
      ? { color: KIND.user, title: 'You' }
      : task
        ? { color: KIND.notification, title: '📬 task' }
        : from
          ? { color: KIND.message, title: '✉ message' }
          : null
    if (!kind) return next(e)

    const { Box, Text } = $.ui.resolve(e)

    return (
      <Box {...CARD} borderColor={kind.color}>
        <Text color={kind.color} bold>{kind.title}</Text>
        {await next(e)}
      </Box>
    )
  })

  // The question dialog as a card; the engine's node stays the only child below the title.
  on('ui.render', { component: 'AskUserQuestion' }, async ($, e, next) => {
    if (e.surface !== 'terminal') return next(e)

    const { Box, Text } = $.ui.resolve(e)

    return (
      <Box {...CARD} borderColor={KIND.question}>
        <Text color={KIND.question} bold>❓ question</Text>
        {await next(e)}
      </Box>
    )
  })

  // Text rewrite only: a custom tree would drop the elapsed time and token count the engine adds.
  on('ui.render', { component: 'Spinner' }, async ($, e, next) => {
    if (e.surface !== 'terminal') return next(e)
    return next({ ...e, props: { ...e.props, word: `${MODE_ICON[e.props.mode]} ${e.props.word}` } })
  })

  // Slash command output (/cost, /context ...) as a card titled with the command.
  on('ui.render', { component: 'CommandOutput' }, async ($, e, next) => {
    if (e.surface !== 'terminal') return next(e)

    const { Box, Text } = $.ui.resolve(e)

    return (
      <Box {...CARD} borderColor={KIND.command}>
        <Text>
          <Text color={KIND.command} bold>/{e.props.command}</Text>
          {e.props.isErrored ? <Text color={LOOK.error.color} bold> · {LOOK.error.label}</Text> : null}
        </Text>
        {await next(e)}
      </Box>
    )
  })

  // Status lines under the logo: one gray row with an info mark, no card so the header stays short.
  on('ui.render', { component: 'InfoNotice' }, async ($, e, next) => {
    if (e.surface !== 'terminal') return next(e)

    const { Text } = $.ui.resolve(e)

    return <Text color={KIND.info}>ℹ {e.props.text}{e.props.command ? ` /${e.props.command}` : ''}</Text>
  })

  // Footer mode labels get a marker; the engine still joins and draws them.
  on('ui.render', { component: 'SessionMode' }, async ($, e, next) => {
    if (e.surface !== 'terminal' || e.props.modes.length === 0) return next(e)
    return next({ ...e, props: { ...e.props, modes: e.props.modes.map(m => `◆ ${m}`) } })
  })

  // `tail` only: the engine keeps its live pills, we add the prompt's state at the end.
  on('ui.render', { component: 'PromptHint' }, async ($, e, next) => {
    if (e.surface !== 'terminal' || e.props.tail) return next(e)
    const tail = e.props.isWorking ? '⏳ working' : e.props.isDraft ? '✎ draft' : undefined
    return next(tail ? { ...e, props: { ...e.props, tail } } : e)
  })

  // Turn-closing line as a green done mark; the waiting-for-agents variant keeps the engine's text.
  on('ui.render', { component: 'TurnDuration' }, async ($, e, next) => {
    if (e.surface !== 'terminal' || e.props.isExpanded || e.props.waitingFor) return next(e)

    const { Text } = $.ui.resolve(e)

    return <Text color={LOOK.done.color}>✓ {e.props.word} for {formatDuration(e.props.durationMs)}</Text>
  })

  // The "ctrl+b to run in background" pill, in the running color.
  on('ui.render', { component: 'ToolProgress' }, async ($, e, next) => {
    if (e.surface !== 'terminal' || !e.props.hint) return next(e)

    const { Text } = $.ui.resolve(e)

    return <Text color={LOOK.running.color} dimColor>↳ {e.props.hint}</Text>
  })
}

export const formatDuration = (ms: number) => {
  const s = Math.round(ms / 1000)
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`
}

const MODE_ICON = {
  requesting: '📡',
  thinking: '🧠',
  responding: '✍️',
  'tool-input': '⌨️',
  'tool-use': '🔧',
} as const

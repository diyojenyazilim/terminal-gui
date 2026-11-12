import type { Register } from 'claude-code'

type Status = 'running' | 'done' | 'error'

const LOOK = {
  running: { color: 'yellow', label: '⏳ running' },
  done: { color: 'green', label: '✓ done' },
  error: { color: 'red', label: '✗ failed' },
} as const

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
    const status = statusOf({ isRunning, isErrored, isInterrupted })
    const look = LOOK[status]
    const agent = isAgent(tool)
    const color = agent && status === 'running' ? 'magenta' : agent && status === 'done' ? 'blue' : look.color
    const desc = agent ? (input as { description?: string; subagent_type?: string }) : undefined
    const title = agent ? `🤖 ${desc?.subagent_type ?? 'agent'}${desc?.description ? `: ${desc.description}` : ''}` : tool

    return (
      <Box flexDirection="column" borderStyle="round" borderColor={color} paddingX={1}>
        <Text color={color} bold wrap="truncate-end">{title} · {look.label}</Text>
        {await next(e)}
      </Box>
    )
  })

  on('ui.render', { component: 'ToolResult' }, async ($, e, next) => {
    if (e.surface !== 'terminal' || e.props.isExpanded) return next(e)

    const { Box } = $.ui.resolve(e)

    return (
      <Box flexDirection="column" borderStyle="single" borderColor={e.props.isErrored ? 'red' : 'green'} borderDimColor paddingX={1}>
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
      <Box flexDirection="column" borderStyle="round" borderColor={look.color} paddingX={1}>
        <Text color={look.color} bold>{calls.length} tool calls · {look.label}</Text>
        {await next(e)}
      </Box>
    )
  })

  on('ui.render', { component: 'AssistantMessage' }, async ($, e, next) => {
    if (e.surface !== 'terminal') return next(e)

    const { Box, Text } = $.ui.resolve(e)

    return (
      <Box flexDirection="column" borderStyle="round" borderColor="cyan" paddingX={1}>
        {e.props.isFirstOfReply ? <Text color="cyan" bold>Claude</Text> : null}
        {await next(e)}
      </Box>
    )
  })

  // Only what the person typed; notifications and peer messages keep the engine's dim row.
  on('ui.render', { component: 'UserMessage' }, async ($, e, next) => {
    if (e.surface !== 'terminal' || e.props.origin.kind !== 'composer') return next(e)

    const { Box, Text } = $.ui.resolve(e)

    return (
      <Box flexDirection="column" borderStyle="round" borderColor="magenta" paddingX={1}>
        <Text color="magenta" bold>You</Text>
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
    const color = e.props.isErrored ? 'red' : 'blue'

    return (
      <Box flexDirection="column" borderStyle="round" borderColor={color} paddingX={1}>
        <Text color={color} bold>/{e.props.command}</Text>
        {await next(e)}
      </Box>
    )
  })

  // Turn-closing line as a green done mark; the waiting-for-agents variant keeps the engine's text.
  on('ui.render', { component: 'TurnDuration' }, async ($, e, next) => {
    if (e.surface !== 'terminal' || e.props.isExpanded || e.props.waitingFor) return next(e)

    const { Text } = $.ui.resolve(e)

    return <Text color="green">✓ {e.props.word} for {formatDuration(e.props.durationMs)}</Text>
  })

  // The "ctrl+b to run in background" pill, in the running color.
  on('ui.render', { component: 'ToolProgress' }, async ($, e, next) => {
    if (e.surface !== 'terminal' || !e.props.hint) return next(e)

    const { Text } = $.ui.resolve(e)

    return <Text color="yellow" dimColor>↳ {e.props.hint}</Text>
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

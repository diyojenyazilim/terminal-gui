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
}

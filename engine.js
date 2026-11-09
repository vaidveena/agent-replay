// Deterministic teaching simulator. No model, external tools, or network requests.
export const scenarios = {
  healthy: {name: 'The happy path', lesson: 'Read → validate → ask for approval → simulate publication.',
    call: {tool: 'lookup_ticket', arguments: {ticket_id: 'DEMO-42'}},
    responses: [{status: 'ready', blockers: 0}]},
  recovery: {name: 'One timeout, then recovery', lesson: 'A transient failure can recover within the retry and tool-call budgets.',
    call: {tool: 'lookup_ticket', arguments: {ticket_id: 'DEMO-42'}},
    responses: [{error: 'timeout'}, {status: 'ready', blockers: 0}]},
  exhausted: {name: 'The service stays unavailable', lesson: 'Retries stop at an explicit limit. Failure does not become a successful result.',
    call: {tool: 'lookup_ticket', arguments: {ticket_id: 'DEMO-42'}},
    responses: [{error: 'timeout'}, {error: 'timeout'}, {error: 'timeout'}]},
  badArguments: {name: 'Malformed tool arguments', lesson: 'Invalid arguments are rejected before any tool execution.',
    call: {tool: 'lookup_ticket', arguments: {ticket_id: 42}},
    responses: [{status: 'ready', blockers: 0}]},
  badResult: {name: 'A result that breaks the contract', lesson: 'A successful call can still return unusable data. Validate before continuing.',
    call: {tool: 'lookup_ticket', arguments: {ticket_id: 'DEMO-42'}},
    responses: [{status: 'ready', blockers: 'zero'}]},
  forbidden: {name: 'A tool outside the allowlist', lesson: 'A proposed tool call is not permission to execute it.',
    call: {tool: 'delete_ticket', arguments: {ticket_id: 'DEMO-42'}},
    responses: [{status: 'ready', blockers: 0}]},
};
const terminal = new Set(['completed', 'failed', 'cancelled']);
export const isTerminal = run => terminal.has(run.state);

export function createRun(scenarioId = 'healthy', {maxCalls = 3, maxRetries = 1} = {}) {
  if (!Object.hasOwn(scenarios, scenarioId)) throw Error('Choose a known scenario.');
  if (!Number.isInteger(maxCalls) || maxCalls < 1 || maxCalls > 5) throw Error('Tool-call budget must be 1–5.');
  if (!Number.isInteger(maxRetries) || maxRetries < 0 || maxRetries > 2) throw Error('Retry budget must be 0–2.');
  return {scenarioId, maxCalls, maxRetries, state: 'ready', calls: 0, attempts: 0,
    approved: false, result: null, events: [], summary: ''};
}

export function validCall(call) {
  return call?.tool === 'lookup_ticket' && call.arguments &&
    Object.keys(call.arguments).length === 1 &&
    typeof call.arguments.ticket_id === 'string' && /^DEMO-\d+$/.test(call.arguments.ticket_id);
}

export function validResult(result) {
  return result !== null && typeof result === 'object' &&
    Object.keys(result).length === 2 && ['ready','blocked'].includes(result.status) &&
    Number.isInteger(result.blockers) && result.blockers >= 0 &&
    ((result.status === 'ready' && result.blockers === 0) || (result.status === 'blocked' && result.blockers > 0));
}

export function transition(previous, action = 'step') {
  if (!['step','approve','reject'].includes(action)) throw Error('Unknown action.');
  if (isTerminal(previous)) return previous;
  const run = structuredClone(previous);
  const scenario = scenarios[run.scenarioId];
  const log = (kind, message, data = null) => run.events.push({number: run.events.length + 1, kind, message, data});
  const fail = message => {run.state = 'failed'; log('stop', message);};
  if (action === 'approve' || action === 'reject') {
    if (run.state !== 'awaiting_approval') throw Error('There is no pending approval.');
    if (action === 'reject') {run.state = 'cancelled';log('decision','Human declined. No simulated write executed.');}
    else {run.approved = true;run.state = 'write_pending';log('decision','Human approved this simulated summary.');}
    return run;
  }
  switch (run.state) {
    case 'ready':
      run.state = 'validate_call';
      log('plan','Proposed a lookup call. Validate the tool and arguments before execution.',scenario.call);
      break;
    case 'validate_call':
      if (!validCall(scenario.call)) {fail('Tool or arguments rejected. No lookup executed.');break;}
      run.state = 'read_pending';log('check','Tool allowlist and argument checks passed.');break;
    case 'read_pending': {
      if (run.calls >= run.maxCalls) {fail('Tool-call budget exhausted before lookup.');break;}
      const response = scenario.responses[Math.min(run.attempts, scenario.responses.length - 1)];
      run.calls++;run.attempts++;
      log('tool',`Simulated lookup_ticket attempt ${run.attempts}.`,response);
      if (response.error) {
        if (run.attempts <= run.maxRetries && run.calls < run.maxCalls) {
          run.state = 'retry_pending';log('retry','Timeout. One retry is scheduled; no partial result is accepted.');
        } else fail('Lookup failed. Retry or tool-call budget exhausted.');
      } else if (!validResult(response)) fail('Tool output failed validation. No approval or publication requested.');
      else {
        run.result = structuredClone(response);
        run.summary = `DEMO-42: ${response.status}; ${response.blockers} blockers.`;
        run.state = 'awaiting_approval';
        log('approval','Review the summary before permitting a simulated write.',{summary: run.summary});
      }
      break;
    }
    case 'retry_pending':
      run.state = 'read_pending';log('check','Retry stays within the configured limits.');break;
    case 'awaiting_approval':
      return previous; // A normal step cannot grant approval.
    case 'write_pending':
      if (!run.approved || !validResult(run.result)) {fail('A valid result and human approval are required.');break;}
      if (run.calls >= run.maxCalls) {fail('Tool-call budget exhausted before simulated publication.');break;}
      run.calls++;run.state = 'completed';
      log('tool','Simulated publish_summary completed. Nothing was sent externally.',{summary: run.summary});break;
    default: throw Error('Unknown workflow state.');
  }
  return run;
}

export function runUntilPause(run) {
  let current = run;
  for (let i = 0; i < 20; i++) {
    if (isTerminal(current) || current.state === 'awaiting_approval') return current;
    current = transition(current);
  }
  throw Error('Workflow exceeded its transition limit.');
}

export function exportTrace(run) {
  return JSON.stringify({format: 'agent-replay-v1', simulation: true, ...run}, null, 2);
}

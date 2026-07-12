export function toolText(data) {
    const text = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
    return { content: [{ type: 'text', text }] };
}

export function toolError(err) {
    return { content: [{ type: 'text', text: `Error: ${err.message || String(err)}` }], isError: true };
}

// Wraps a tool handler so thrown errors become a proper MCP error result
// instead of crashing the server or the calling agent's tool-use loop.
export function wrap(fn) {
    return async (args) => {
        try {
            const result = await fn(args || {});
            return toolText(result);
        } catch (err) {
            return toolError(err);
        }
    };
}

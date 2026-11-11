// One tool whose parameters are the shape we want back. tool_choice forces the model to call it,
// so the answer arrives as JSON in tool_calls[0].function.arguments, never as free text to parse.
//
// The answer is an array of lines, not one multi-line string: some free models/providers cut a
// string argument at its first line break, which turned tables into a lone header row.
export const chatTool = {
  type: 'function' as const,
  function: {
    name: 'answer',
    description: "Answer the user's health question, grounded in the provided sources.",
    parameters: {
      type: 'object',
      properties: {
        reply_lines: {
          type: 'array',
          items: { type: 'string' },
          description:
            'The answer in Markdown, one array item per line. Use an empty string for a blank line. ' +
            'Use tables when they help (one table row per item).',
        },
        cited_sources: {
          type: 'array',
          items: { type: 'integer' },
          description: 'Numbers of the [Source n] excerpts you actually used. Empty if none.',
        },
      },
      required: ['reply_lines', 'cited_sources'],
    },
  },
};

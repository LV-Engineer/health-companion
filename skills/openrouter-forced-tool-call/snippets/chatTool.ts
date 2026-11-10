// One tool whose parameters are the shape we want back. tool_choice forces the model to call it,
// so the answer arrives as JSON in tool_calls[0].function.arguments, never as free text to parse.
export const chatTool = {
  type: 'function' as const,
  function: {
    name: 'answer',
    description: "Answer the user's health question, grounded in the provided sources.",
    parameters: {
      type: 'object',
      properties: {
        reply: {
          type: 'string',
          description: 'The answer in Markdown. Use tables when they help.',
        },
        cited_sources: {
          type: 'array',
          items: { type: 'integer' },
          description: 'Numbers of the [Source n] excerpts you actually used. Empty if none.',
        },
      },
      required: ['reply', 'cited_sources'],
    },
  },
};

// Import the marked library directly
const marked = require('marked');

// First, let's look at how marked tokenizes nested blockquotes
const nestedBlockquotes = `
> Outer blockquote
> > Nested blockquote
> > > Deeply nested blockquote
`;

// And nested lists
const nestedLists = `
- Level 1
  - Level 2
    - Level 3
`;

console.log('=== NESTED BLOCKQUOTES TOKENS ===');
const blockquoteTokens = marked.lexer(nestedBlockquotes);
console.log(JSON.stringify(blockquoteTokens, null, 2));

console.log('\n\n=== NESTED LISTS TOKENS ===');
const listTokens = marked.lexer(nestedLists);
console.log(JSON.stringify(listTokens, null, 2));

// Let's also visualize the HTML to see how marked would render it
console.log('\n\n=== NESTED BLOCKQUOTES HTML ===');
console.log(marked.parse(nestedBlockquotes));

console.log('\n\n=== NESTED LISTS HTML ===');
console.log(marked.parse(nestedLists));

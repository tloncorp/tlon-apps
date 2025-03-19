const { markdownToStory } = require('./utils/markdown');

// Test nested blockquotes
const nestedBlockquotes = `
> Outer blockquote
> > Nested blockquote
> > > Deeply nested blockquote
`;

// Test nested lists
const nestedLists = `
- Level 1
  - Level 2
    - Level 3
      - Level 4
        - Level 5
`;

console.log('=== NESTED BLOCKQUOTES ===');
console.log(JSON.stringify(markdownToStory(nestedBlockquotes), null, 2));

console.log('\n\n=== NESTED LISTS ===');
console.log(JSON.stringify(markdownToStory(nestedLists), null, 2));

const { marked } = require('marked');

const nestedList = `
* Item 1
* Item 2
  * Nested item 2.1
  * Nested item 2.2
* Item 3
`;

// Parse the markdown
const tokens = marked.lexer(nestedList);

// Log the full token structure to understand nested list representation
console.log('LIST TOKENS:');
console.log(JSON.stringify(tokens, null, 2));

// Specifically look at items to check for nesting
if (tokens[0].type === 'list' && tokens[0].items) {
  console.log('\nLIST ITEMS:');
  tokens[0].items.forEach((item, i) => {
    console.log(`\nItem ${i + 1}:`);
    console.log(JSON.stringify(item, null, 2));

    // Check for nested items
    if ('items' in item && item.items) {
      console.log(`\n  Nested items for item ${i + 1}:`);
      console.log(JSON.stringify(item.items, null, 2));
    }
  });
}

// Also check the HTML output
console.log('\nHTML OUTPUT:');
console.log(marked.parse(nestedList));

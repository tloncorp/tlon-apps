const { markdownToStory } = require('./utils/markdown');

const nestedList = `
* Item 1
* Item 2
  * Nested item 2.1
  * Nested item 2.2
* Item 3
`;

// Check how our parser handles nested lists
const story = markdownToStory(nestedList);
console.log('PARSED STORY:');
console.log(JSON.stringify(story, null, 2));

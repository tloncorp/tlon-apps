import { MessageInputEditor } from './MessageInputEditor';
import { NotebookEditor } from './NotebookEditor';

export default function App() {
  const mode = import.meta.env.MODE;

  if (mode === 'notebook') {
    return <div>Not supported</div>;
  }

  return <MessageInputEditor />;
}

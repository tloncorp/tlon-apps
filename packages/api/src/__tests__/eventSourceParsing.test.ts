import { expect, it } from 'vitest';
import { getLines, getMessages, type EventSourceMessage } from '../http-api/fetch-event-source/parse';

it.each(['id-first', 'id-last'])('preserves event data with %s across every byte split', (order) => {
  const data = 'data: {"id":1,"response":"poke","ok":null}';
  const fields = order === 'id-first' ? ['id: 7', data] : [data, 'id: 7'];
  const bytes = new TextEncoder().encode([...fields, '', ''].join('\r\n'));
  for (let split = 1; split < bytes.length; split++) {
    const messages: EventSourceMessage[] = [];
    const parse = getLines(getMessages(message => messages.push(message)));
    parse(bytes.slice(0, split));
    parse(bytes.slice(split));
    expect(messages).toEqual([{
      id: '7', data: '{"id":1,"response":"poke","ok":null}', event: '', retry: undefined,
    }]);
  }
});

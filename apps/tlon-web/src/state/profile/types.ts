type Desk = string;
type Term = string;
type Description = string;

interface WidgetId {
  desk: Desk;
  term: Term;
}

export type ProfWidgets = Record<Desk, Record<Term, Description>>;
export type ProfLayout = WidgetId[];

export interface Widget {
  id: string;
  name: string;
  sourceApp: string;
  visible: boolean;
}

export function getWidgetIdParts(id: string): { desk: Desk; term: Term } {
  const [desk, term] = id.split(':');
  return { desk, term };
}

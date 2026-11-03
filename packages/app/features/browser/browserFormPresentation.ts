import type { BrowserSecureField } from './browserCredentialHandoff';

export function browserFieldLabel(field: BrowserSecureField): string {
  const label = field.label.replace(/\s*\(optional\)/gi, '').trim();
  // Some checkout sites expose the radio group's internal name as its label.
  if (
    label.toLowerCase() === 'basic' &&
    field.options?.some((option) => /credit card|paypal/i.test(option.label))
  ) {
    return 'Payment method';
  }
  return label;
}

export function browserFieldSections(fields: BrowserSecureField[]) {
  const sections: { title: string; fields: BrowserSecureField[] }[] = [];
  for (const field of fields) {
    const label = browserFieldLabel(field);
    const prefix = /^(shipping|billing)\s*:\s*/i.exec(label);
    const title = prefix
      ? prefix[1].toLowerCase() === 'shipping'
        ? 'Shipping'
        : 'Billing'
      : field.purpose.startsWith('cc-') || label === 'Payment method'
        ? 'Payment'
        : (sections.at(-1)?.title ?? 'Details');
    let section = sections.at(-1);
    if (!section || section.title !== title) {
      section = { title, fields: [] };
      sections.push(section);
    }
    section.fields.push({
      ...field,
      label: label.replace(/^(shipping|billing)\s*:\s*/i, ''),
    });
  }
  return sections;
}

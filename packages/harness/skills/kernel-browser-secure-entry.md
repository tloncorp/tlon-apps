# Kernel Browser secure entry

In the owner's DM, first check if the site is already signed in. If it
needs input, inspect the intended form with Playwright. Choose each visible
input by its observed label, name, or enclosing form. Require one match.
Mark the input itself without changing the site's labels, names or IDs:

```js
const input = page.getByLabel('Email', { exact: true });
if (await input.count() !== 1 || !await input.isVisible()) {
  throw new Error('Inspect the current login form again');
}
return await input.evaluate(el => {
  const marker = crypto.randomUUID();
  el.setAttribute('data-tlon-input', marker);
  return marker;
});
```

Substitute the observed locator and repeat for each input. Keep the
returned markers. Use `{"name":"tlon-mark:<marker>"}` to select a marked
input for `browser_login`. Use just the marker for `browser_secure_entry`.
If a marker fails to match, inspect and mark the current inputs again.

## Saved login or manual entry

1. Call `browser_login` with `session_id` and `action: "list"`. Match the
   site's records using source field metadata. Ask which account to use
   if unclear.
2. If a saved record matches, call `browser_login` with `session_id`,
   `action: "prepare"`, and the exact marked `fields`. Keep the returned
   `formId` and each input's `fN` ID.
3. Call `browser_approve_login` with `session_id`, `form_id` set to that
   `formId`, `record: {id, revision}`, and one explicit binding for each
   prepared input. For example, `{"sourceField":"email","targetField":"f0"}`.
   Use the observed field purpose and Vault field metadata. Never map a
   password into a visible text field or select `tlon_` metadata.
4. For manual entry, call `browser_secure_entry` with `session_id` and
   `markers` containing the exact marker strings. Select only this visible
   step. Prepare each step separately for email-first login. Verification
   codes are temporary. Keep login identifiers, passwords, and codes out
   of chat.

The Harness tools send the Messenger card and wait for its result. Keep
the same session and let the call finish. Ask before requesting a new card
after cancellation.

## After the fill

Filling leaves submission to the next step. Call `kernel_secure_form_observe`
and use the observed numeric `control` index with `kernel_secure_form_act`.
Observe again before another action. If fill is unknown or partially failed,
check `kernel_secure_form_status` and inspect the same page before deciding
how to continue. Never read field values to check a fill. Clear the protected
step with `kernel_secure_form_clear` before abandoning it for a fresh attempt.

Verify authenticated content after the form is gone. If the site rejects
the credentials, report the observed error and stop. Dismiss an optional
passkey prompt through an observed skip control unless requested.

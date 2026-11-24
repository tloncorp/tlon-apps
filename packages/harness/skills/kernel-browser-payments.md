# Kernel Browser payment and checkout

When asked to buy, carry the task through item selection, cart, and checkout
to approval. Respect explicit limits such as stopping before purchase.
Ask about unresolved choices. Group missing ordinary checkout details in
one question where possible, then continue after the answer. Contact email,
shipping address, and delivery preferences can be filled with ordinary
browser tools. Use secure entry for a login identifier or private detail.
Keep card numbers and verification codes out of chat.

## Choose the payment method

- **Site-saved method.** Inspect the selected method and destination on the
  site. Use `payment_source: "site_saved"` and pass their non-sensitive labels
  as `saved_payment`. This path uses the method already on the site.
- **Stripe Link.** Use `wallet_status` and `wallet_details` when available.
  Check saved shipping options early, since they can settle tax and shipping.
  Ask which card or address to use if unclear. Use the chosen Link
  `payment_method_id`. If Link is disconnected, call `browser_connect_wallet`
  in the owner DM. Wait for the Messenger card result, then check the
  checkout again. Connecting Link still requires separate purchase approval.

## Request and complete approval

Read the `payment_request` schema with `list_mcp_tools`. Call the native
`browser_request_payment` tool directly, passing the checkout JSON as its
`arguments` string. The raw MCP `payment_request` call is unavailable.
Supply the merchant, line items, total in integer minor units, and a
unique `request_key`. Keep the same browser and key for this attempt.
Harness sends the Messenger card and waits. Use `payment_cancel` to
abandon an unfilled request.

If the request times out, check `payment_status` by the original key.
Do not create another request while its state is uncertain. After the
owner approves, check status by the returned request ID and proceed on
`ready`. Recheck merchant, items, total, method, and destination against
the approval. Changed terms require a fresh approval.

For a site-saved method, use the selected method directly. For Link, use
`browser_fill_payment` with the approved request ID and exact card-field
selectors, including any frames. Use `payment_status` with
`inspect_fields: true` if helpful. A mapping error preserves approval.
Correct the mapping with the same request ID. Keep filled fields masked.
If the fill outcome is unknown, inspect the page before taking another
action and do not repeat the fill automatically.

Use the observed final-order control once within the reviewed terms.
After Link fill, use `kernel_secure_form_observe` first. Pass its selected
numeric index as `control` to `kernel_secure_form_act` with `session_id`.
Verify explicit order confirmation and its number before reporting success.
After uncertain submission, inspect the page or order history without
resubmitting. If cancelled, expired, or failed, report the result. Ask the
owner before starting a replacement after cancellation.

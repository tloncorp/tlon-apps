// Expense split — the template that exists because this app shipped inert.
//
// Three times a generated "who owes what for the trip" board shipped with an
// EMPTY action map: it rendered the split beautifully and offered nobody a
// way to add anything to it. Twice silently; the third time with the
// display-only marker declared, one session after the failure was named.
// Nothing in the gate or the rubric could see it, because a screenshot of a
// board nobody can touch looks exactly like a screenshot of a board somebody
// can (PARADIGM.md §2, RUBRIC.md check 8).
//
// So the first thing to read in this file is the CLAIM table below: the
// member actions are the app. A member says which cost they paid, and says
// whether they are sharing the trip at all. Everything else on screen —
// totals, per-person shares, balances, who pays whom — is DERIVED from those
// two facts at render time. If you adapt this template and end up with no
// member actions, you have not adapted it; you have rebuilt the bug.
//
// Two things this app deliberately does not do, because v0 cannot:
//   - it never calls `Date`. There is no "added yesterday" and no deadline;
//     the sandbox's clock is the viewer's, not the group's.
//   - it cannot say who is looking at it. So the controls are labelled "I
//     paid this" / "Count me in" — true whoever presses them, because the
//     write lands at the presser's own key server-side — and the sheet is
//     shown in full, every member's row led by their sigil.
(function () {
  const { html, primitives, invoke, canInvoke } = surface;
  const {
    Card,
    ListRow,
    Button,
    Stat,
    Badge,
    Avatar,
    EmptyState,
    SectionHeader,
  } = primitives;

  // ONE ENTRY PER COST, keyed by the cost id it belongs to. Each invoke()
  // argument is a literal on purpose: the publish gate cross-references
  // literals against the spec, so a typo here fails the gate instead of
  // shipping a button that silently does nothing. Writing
  // `invoke('paid-' + item.id)` reads better and turns that check off for
  // the whole app.
  //
  // Adding a cost is three edits the gate keeps consistent: the cost in
  // `initialState.items` (plus `itemOrder`), its action in spec.json, and
  // its line here — and on a sheet that already has money on it, a host
  // event as well. NOTES.md, "Adding a cost", has the ops.
  const CLAIM = {
    house: function () {
      return invoke('paid-house');
    },
    van: function () {
      return invoke('paid-van');
    },
    food: function () {
      return invoke('paid-food');
    },
    ferry: function () {
      return invoke('paid-ferry');
    },
  };

  const joinTrip = function () {
    return invoke('join-trip');
  };

  const leaveTrip = function () {
    return invoke('leave-trip');
  };

  const has = function (object, key) {
    return Object.prototype.hasOwnProperty.call(object, key);
  };

  /* ---------------------------------------------------------------- */
  /* money: integer cents, everywhere, including the split             */
  /*                                                                   */
  /* £84.25 as 84.25 and a third of it is 28.083333333333332, and two  */
  /* of those plus one more is 84.24999999999999 — a sheet that is one */
  /* penny short of the money that was actually spent, which is the    */
  /* one defect nobody forgives in a bill-splitting app. So every      */
  /* amount here is a whole number of cents from the moment it is read */
  /* out of state to the moment `money()` puts the point back in, and  */
  /* the leftover cents of an uneven split are handed out one at a     */
  /* time (see `sharesOf`) rather than rounded and hoped over.         */
  /* ---------------------------------------------------------------- */

  /** Cents as stored — an integer, whatever state actually holds. */
  const centsOf = function (value) {
    return typeof value === 'number' && isFinite(value) ? Math.round(value) : 0;
  };

  const pad2 = function (value) {
    return value < 10 ? '0' + String(value) : String(value);
  };

  /** The ONLY division in this file, and it is in the formatter. */
  const money = function (currency, cents) {
    const size = Math.abs(cents);
    return (
      (cents < 0 ? '−' : '') +
      currency +
      String(Math.floor(size / 100)) +
      '.' +
      pad2(size % 100)
    );
  };

  /* ---------------------------------------------------------------- */
  /* derivation                                                        */
  /* ---------------------------------------------------------------- */

  /**
   * The costs, in the order the sheet lists them. An id in the order with
   * no cost against it is skipped rather than drawn empty — state is
   * shared, and half a cost is not worth a broken row.
   */
  const costsOf = function (state) {
    const items =
      state.items && typeof state.items === 'object' ? state.items : {};
    const order = Array.isArray(state.itemOrder)
      ? state.itemOrder
      : Object.keys(items).sort();
    const paidBy =
      state.paidBy && typeof state.paidBy === 'object' ? state.paidBy : {};
    const costs = [];
    for (const id of order) {
      if (typeof id !== 'string' || !has(items, id)) {
        continue;
      }
      const item = items[id] || {};
      costs.push({
        id: id,
        label: item.label || id,
        cents: centsOf(item.cents),
        payer: typeof paidBy[id] === 'string' ? paidBy[id] : null,
      });
    }
    return costs;
  };

  /**
   * Everyone the sheet is split between: whoever put themselves on it, plus
   * anyone who paid for something. A member who drops out after paying for
   * the van stays on the sheet, because the group still owes them for it.
   */
  const sheetOf = function (state, costs) {
    const seen = {};
    const crew = state.crew && typeof state.crew === 'object' ? state.crew : {};
    for (const ship of Object.keys(crew)) {
      seen[ship] = true;
    }
    for (const cost of costs) {
      if (cost.payer !== null) {
        seen[cost.payer] = true;
      }
    }
    return Object.keys(seen).sort();
  };

  /**
   * Splits whole cents evenly. `Math.floor` leaves at most one cent per
   * person over; those go one each to the first names on the sheet, so the
   * shares add back up to exactly what was spent. Divide-and-round-each
   * would leave the sheet a cent or two off and no two members would agree
   * about who owes it.
   */
  const sharesOf = function (total, sheet) {
    const shares = {};
    if (sheet.length === 0) {
      return shares;
    }
    const base = Math.floor(total / sheet.length);
    let over = total - base * sheet.length;
    for (const ship of sheet) {
      shares[ship] = base + (over > 0 ? 1 : 0);
      if (over > 0) {
        over -= 1;
      }
    }
    return shares;
  };

  /**
   * The fewest payments that square everyone up: the biggest debt against
   * the biggest credit, repeatedly. Every amount is whole cents, and the
   * balances sum to zero exactly (each claimed cost is counted once as
   * somebody's payment and once, in pieces, as everybody's share), so this
   * always terminates with nobody left owing anything.
   */
  const paymentsFor = function (sheet, balances) {
    const owing = [];
    const owed = [];
    for (const ship of sheet) {
      const balance = balances[ship] || 0;
      if (balance < 0) {
        owing.push({ ship: ship, cents: -balance });
      } else if (balance > 0) {
        owed.push({ ship: ship, cents: balance });
      }
    }
    const bigger = function (left, right) {
      return right.cents - left.cents;
    };
    owing.sort(bigger);
    owed.sort(bigger);

    const payments = [];
    let from = 0;
    let to = 0;
    while (from < owing.length && to < owed.length) {
      const amount = Math.min(owing[from].cents, owed[to].cents);
      payments.push({
        from: owing[from].ship,
        to: owed[to].ship,
        cents: amount,
      });
      owing[from].cents -= amount;
      owed[to].cents -= amount;
      if (owing[from].cents === 0) {
        from += 1;
      }
      if (owed[to].cents === 0) {
        to += 1;
      }
    }
    return payments;
  };

  /* ---------------------------------------------------------------- */
  /* render                                                            */
  /* ---------------------------------------------------------------- */

  surface.register({
    render(state) {
      // State is shared, so every read defaults: one odd entry must not
      // throw the sheet for the whole group.
      const currency =
        typeof state.currency === 'string' ? state.currency : '$';
      const costs = costsOf(state);
      const sheet = sheetOf(state, costs);

      // Only claimed costs are split. An unclaimed cost is money nobody has
      // said they put in yet, and counting it would invent a debt.
      let total = 0;
      let unclaimed = 0;
      const paid = {};
      for (const ship of sheet) {
        paid[ship] = 0;
      }
      for (const cost of costs) {
        if (cost.payer === null) {
          unclaimed += 1;
          continue;
        }
        total += cost.cents;
        paid[cost.payer] = (paid[cost.payer] || 0) + cost.cents;
      }

      const shares = sharesOf(total, sheet);
      const balances = {};
      for (const ship of sheet) {
        balances[ship] = (paid[ship] || 0) - (shares[ship] || 0);
      }
      const payments = paymentsFor(sheet, balances);
      const each = sheet.length === 0 ? 0 : Math.floor(total / sheet.length);

      // Whatever a member has to know goes in a Stat's LABEL. The hint is
      // the quietest text on the card in either theme, so a fact that
      // appears only there is a fact half the group never reads.
      return html`
        <${Card} title=${state.trip || 'Trip costs'}>
          <div data-testid="split-summary">
            <${Stat}
              value=${money(currency, total)}
              label="paid so far"
              hint=${unclaimed === 0
                ? 'nothing left to claim'
                : String(unclaimed) + ' still to claim'}
            />
            <${Stat}
              value=${money(currency, each)}
              label=${sheet.length === 0
                ? 'a head — nobody is on the sheet yet'
                : 'a head, split ' + String(sheet.length) + ' ways'}
              hint=${sheet.length === 0
                ? 'put yourself on the sheet below'
                : 'to the cent, so the sheet adds up'}
            />
          </div>
        <//>

        <${Card} title="Costs">
          ${costs.length === 0
            ? html`<${EmptyState}
                title="No costs yet"
                description="Costs for this trip will be listed here."
              />`
            : costs.map(function (cost) {
                return html`
                  <${ListRow}
                    right=${html`
                      <${Button}
                        disabled=${!canInvoke() || !has(CLAIM, cost.id)}
                        onPress=${CLAIM[cost.id]}
                      >
                        I paid this
                      <//>
                    `}
                  >
                    <div data-testid=${'split-cost-' + cost.id}>
                      <div>
                        ${cost.label}
                        <${Badge}>${money(currency, cost.cents)}<//>
                      </div>
                      <div>
                        ${cost.payer === null
                          ? 'nobody has said they paid this'
                          : html`<${Avatar} ship=${cost.payer} /> ${' ' +
                              cost.payer +
                              ' paid'}`}
                      </div>
                    </div>
                  <//>
                `;
              })}
        <//>

        <${Card} title="Who owes what">
          <${ListRow}>
            <div>
              <div>
                ${'Sharing these costs? Put yourself on the sheet and the split includes you.'}
              </div>
              <div
                style="display: flex; gap: var(--space-m); margin-top: var(--space-m)"
              >
                <${Button}
                  tone="positive"
                  disabled=${!canInvoke()}
                  onPress=${joinTrip}
                >
                  Count me in
                <//>
                <${Button} disabled=${!canInvoke()} onPress=${leaveTrip}>
                  Take me off
                <//>
              </div>
            </div>
          <//>

          ${sheet.length === 0
            ? html`<${EmptyState}
                title="Nobody is on the sheet yet"
                description="Tap Count me in, or claim a cost you paid for."
              />`
            : sheet.map(function (ship) {
                const balance = balances[ship] || 0;
                const settled = balance === 0;
                return html`
                  <${ListRow}
                    left=${html`<${Avatar} ship=${ship} />`}
                    right=${html`<${Badge}
                      tone=${settled
                        ? 'neutral'
                        : balance > 0
                          ? 'positive'
                          : 'negative'}
                      >${settled
                        ? 'square'
                        : balance > 0
                          ? 'gets back ' + money(currency, balance)
                          : 'owes ' + money(currency, -balance)}<//
                    >`}
                  >
                    <div data-testid=${'split-member-' + ship}>
                      <div>${ship}</div>
                      <div>
                        ${'put in ' +
                        money(currency, paid[ship] || 0) +
                        ' · share ' +
                        money(currency, shares[ship] || 0)}
                      </div>
                    </div>
                  <//>
                `;
              })}
          ${sheet.length === 0 ? null : html`<${SectionHeader}>Settle up<//>`}
          ${sheet.length === 0
            ? null
            : payments.length === 0
              ? html`<${EmptyState}
                  title="Nothing to settle yet"
                  description="Claim what you paid for and the payments work themselves out."
                />`
              : payments.map(function (payment) {
                  return html`
                    <${ListRow}
                      left=${html`<${Avatar} ship=${payment.from} />`}
                      right=${html`<${Badge}
                        >${money(currency, payment.cents)}<//
                      >`}
                    >
                      <div
                        data-testid=${'split-payment-' +
                        payment.from +
                        '-' +
                        payment.to}
                      >
                        ${payment.from + ' pays ' + payment.to}
                      </div>
                    <//>
                  `;
                })}
        <//>
      `;
    },
  });
})();

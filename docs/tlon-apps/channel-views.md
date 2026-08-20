# Channel views

How a channel says which renderers it wants, how the client resolves that to components, and what happens when it names one this build has never heard of.

## The three slots

A channel's `contentConfiguration` names up to three renderers (`packages/api/src/client/channelContentConfig.ts`):

| field                           | what it selects                      | resolved in                                |
| ------------------------------- | ------------------------------------ | ------------------------------------------ |
| `draftInput`                    | the composer                         | `ui/components/Channel/DraftInputView.tsx` |
| `defaultPostContentRenderer`    | how one post is drawn                | `ui/components/Channel/PostView.tsx`       |
| `defaultPostCollectionRenderer` | how the whole collection is laid out | `ui/components/PostCollectionView.tsx`     |

Each field takes either a bare id string or `{id, configuration}`. `decode` normalizes both to the object form, so read them through `ChannelContentConfiguration.draftInput(...)` and friends rather than touching the fields directly.

The configuration is **not** a separate wire field. It is JSON stored in the channel's `description`, encoded and decoded by `StructuredChannelDescriptionPayload`. That means it replicates with the channel to every member, and any client or agent that can edit channel metadata can write it — `createChannel` and `updateChannel` (`packages/shared/src/store/channelActions.ts`) both accept a `contentConfiguration` and handle the encoding.

There is no per-post renderer override. A comment in `channelContentConfig.ts` used to imply post metadata could take precedence over the channel config; it cannot, and `PostMetadata` has no such field.

## Registering a view

The three registries live in `ComponentsKitContext` (`packages/app/ui/contexts/componentsKits`), keyed by open id strings. The built-ins are declared in `ComponentsKitProvider`. To add one without editing those built-ins, pass a `ChannelView` to the provider:

```tsx
const mealPlanView: ChannelView = {
    id: 'tlon.r0.view.mealPlan',
    displayName: 'Meal plan',
    collection: MealPlanCollection,
    content: MealPlanPost,
    input: MealPlanInput,
};

<ComponentsKitProvider views={[mealPlanView]}>{children}</ComponentsKitProvider>;
```

A view may fill any subset of the three slots. A channel that names the same id in several `contentConfiguration` fields resolves each from that one entry, so a custom surface is declared under one name rather than three — while the wire format stays three independent ids.

**Built-ins win on collision.** Registering a view whose id matches a built-in is ignored with a warning: a third party must not be able to replace `chat` and take the composer out from under every conversation in the app.

## What "open" does and does not mean

Declaring a view needs no app release. The id is an arbitrary string in channel metadata, so a channel can name a view that no client in the world has yet, and clients that do have it will pick it up when they sync.

Implementing a view still needs an app release. Views are React components compiled into the app; a kit cannot ship one. Signed, sandboxed kit code with a replay and upgrade story is deliberately sequenced after this work — see PLAN.md's platform milestone.

So: the _declaration_ half is open, the _implementation_ half is not yet. A kit that wants a custom surface today declares an id whose renderer ships in an app release, and every client without it degrades as below.

## The fallback contract

Resolution goes through `resolveChannelView` (`packages/app/ui/contexts/componentsKits/channelViews.ts`), which reports whether it produced a component from the declaration or from a fallback. The distinction that matters: **an absent declaration is not a degradation.** Most channels declare nothing and resolve to their channel-type built-in, which is the intended path and must not raise a notice. Only a declared-but-unregistered id counts as unresolved.

Per slot, when a channel declares a view this build does not have:

-   **Collection** — renders the ordinary post list (`ListPostCollection`), or the channel-type fallback where one exists (notes). The posts stay readable, which is the whole degradation for this slot; a notice here would mean blanking the channel. Logged at dev level, no user-facing notice.
-   **Post content** — renders the channel-type built-in, so posts stay readable. Logged at dev level, no user-facing notice.
-   **Draft input** — renders `UnsupportedViewNotice` in the composer's place ("Upgrade your app to post in this channel") and fires `AnalyticsEvent.UnknownChannelViewSeen`. This slot has no generic fallback — there is no such thing as a generic composer — and rendering nothing leaves a channel you can read and cannot post to with no explanation, which is the failure this contract exists to prevent.

In practice a kit declares all three, so a client without the renderer shows the posts in a plain list with the notice where the composer would be.

Two more guarantees, both at the parse boundary in `decode`:

-   **An unrecognized id is preserved, not normalized.** Rewriting it to `chat` would make it indistinguishable from "no view declared" and the notice could never fire.
-   **A structurally malformed field defaults to its built-in.** A non-string id, a missing `id`, a non-object `configuration`, an array where an object belongs — each falls back for that field alone. A `channelContentConfiguration` that isn't an object at all is dropped while the channel's `description` survives. Unknown sibling keys ride along untouched, so a configuration written by a newer build round-trips.

An unrecognized `channel.type` is also survivable: `PostView`'s switch has a `default` returning `ChatMessage`. Without it an out-of-union type renders `<undefined>` and throws.

## Testing

-   `packages/api/src/__tests__/channelContentConfig.test.ts` — decode: preserved unknown ids, malformed declarations, dropped configurations.
-   `packages/app/ui/contexts/componentsKits/channelViews.test.ts` — the resolver and the built-in-wins merge.
-   `DraftInputView.test.tsx`, `PostView.test.tsx`, `PostCollectionView.test.tsx` — the three slots' render behavior.
-   `packages/app/fixtures/Channel.fixture.tsx` → `unknownView` — a channel declaring an unregistered view, in cosmos.

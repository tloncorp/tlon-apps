# Icon Export Process

When exporting icons it's important we retain the relative sizing that the designers built in. Here's the process to follow that should lead to a normalized set of icons.

1. Extract them from Figma, making sure you select the frame around the icon, it should be either 16px or 24px. The icons should be square so that we can always size both dimensions equally and scale without skewing.
2. Run them through SVGOMG to shave off some bytes.
3. Copy the resulting code into it's own file, components/icons/XXXXIcon.tsx or components/icons/XXXX16Icon.tsx
4. Use IconProps and put a className prop that applies to the `<svg>`
5. Remove width and height attributes on `<svg>`
6. Ensure `<svg>` has a view box so it can be scaled correctly it should map to either 16 or 24, like this viewBox="0 0 24 24"
7. Put fill-current/stroke-current classes on elements to give them color instead of hard-coded values.
8. If we ever do two-tone icons, use the primary and secondary props and add those to the paths/elements appropriately (aka className={classNames('fill-current', primary)} etc.

module.exports = {
  plugins: [
    "prettier-plugin-tailwindcss",
    "@trivago/prettier-plugin-sort-imports",
  ],
  tailwindConfig: "./tailwind.config.js",
  importOrder: ["<THIRD_PARTY_MODULES>", "^[./]"],
  importOrderSeparation: true,
  importOrderSortSpecifiers: true,
};

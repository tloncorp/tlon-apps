// Codegen-only shim: the config only uses Platform.select; resolve as web.
export const Platform = {
  OS: "web",
  select(options) {
    return "web" in options ? options.web : options.default;
  },
};

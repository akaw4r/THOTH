// Stub used ONLY in the API's jest tests.
// The API does not render markdown in its own process (that's the worker's job);
// it only imports the `@thoth/shared/node` barrel for crypto/DEFAULT_DESIGN, which
// drags in sanitize-html (whose transitive dep htmlparser2 is ESM and breaks under
// ts-jest/CommonJS). The REAL sanitization is validated in the shared package's
// tests (vitest). A passthrough is enough here for the module graph to load.
function sanitizeHtml(html) {
  return html;
}
sanitizeHtml.simpleTransform = function simpleTransform() {
  return function transform(tagName, attribs) {
    return { tagName, attribs };
  };
};
sanitizeHtml.default = sanitizeHtml;
module.exports = sanitizeHtml;

export default function injectCrossOriginScript() {
  return {
    name: 'inject-crossorigin-script',
    transformIndexHtml(html: string) {
      const script = `
        <script>
          (function() {
            // Override Image constructor
            const originalImageConstructor = window.Image;
            window.Image = function() {
              const img = new originalImageConstructor(...arguments);
              img.crossOrigin = 'anonymous';
              return img;
            };
            window.Image.prototype = originalImageConstructor.prototype;

            // Override fetch
            const originalFetch = window.fetch;
            window.fetch = function(input, init) {
              if (init === undefined) {
                init = {};
              }
              if (init.credentials === undefined) {
                init.credentials = 'same-origin';
              }
              return originalFetch(input, init);
            };

            function addCrossOriginToElements() {
              const elements = document.querySelectorAll('img, iframe, embed, audio, video');
              elements.forEach(el => {
                if (!el.hasAttribute('crossorigin')) {
                  el.setAttribute('crossorigin', 'anonymous');
                }
              });
            }

            function setupMutationObserver() {
              const observer = new MutationObserver((mutations) => {
                mutations.forEach((mutation) => {
                  if (mutation.type === 'childList') {
                    mutation.addedNodes.forEach((node) => {
                      if (node.nodeType === 1) { // ELEMENT_NODE
                        if (['IMG', 'IFRAME', 'EMBED', 'AUDIO', 'VIDEO'].includes(node.tagName)) {
                          if (!node.hasAttribute('crossorigin')) {
                            node.setAttribute('crossorigin', 'anonymous');
                          }
                        } else {
                          const elements = node.querySelectorAll('img, iframe, embed, audio, video');
                          elements.forEach(el => {
                            if (!el.hasAttribute('crossorigin')) {
                              el.setAttribute('crossorigin', 'anonymous');
                            }
                          });
                        }
                      }
                    });
                  }
                });
              });

              observer.observe(document.body, {
                childList: true,
                subtree: true
              });
            }

            function init() {
              addCrossOriginToElements();
              setupMutationObserver();
            }

            if (document.readyState === 'loading') {
              document.addEventListener('DOMContentLoaded', init);
            } else {
              init();
            }

            // Also run periodically to catch any missed elements
            setInterval(addCrossOriginToElements, 1000);
          })();
        </script>
      `;
      return html.replace('</head>', `${script}</head>`);
    },
  };
}

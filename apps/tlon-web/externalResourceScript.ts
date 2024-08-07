export default function injectExternalResourceScript() {
  return {
    name: 'inject-external-resource-script',
    transformIndexHtml(html: string) {
      const script = `
        <script>
          (function() {
            // Function to add crossorigin to link elements
            function addCrossOriginToLinks() {
              const links = document.getElementsByTagName('link');
              for (let link of links) {
                if (link.rel === 'stylesheet' || link.rel === 'preload') {
                  if (!link.hasAttribute('crossorigin')) {
                    link.setAttribute('crossorigin', 'anonymous');
                  }
                }
              }
            }

            // Function to add crossorigin to script elements
            function addCrossOriginToScripts() {
              const scripts = document.getElementsByTagName('script');
              for (let script of scripts) {
                if (script.src && !script.hasAttribute('crossorigin')) {
                  script.setAttribute('crossorigin', 'anonymous');
                }
              }
            }

            // Override fetch to add crossorigin
            const originalFetch = window.fetch;
            window.fetch = function(...args) {
              if (args[1] && args[1].mode === 'cors' && !args[1].credentials) {
                if (!args[1].headers) {
                  args[1].headers = {};
                }
                args[1].crossOrigin = 'anonymous';
              }
              return originalFetch.apply(this, args);
            };

            // Override XMLHttpRequest to add crossorigin
            const originalXhrOpen = XMLHttpRequest.prototype.open;
            XMLHttpRequest.prototype.open = function(...args) {
              const result = originalXhrOpen.apply(this, args);
              this.crossOrigin = 'anonymous';
              return result;
            };

            // Run immediately and periodically
            function init() {
              addCrossOriginToLinks();
              addCrossOriginToScripts();
            }

            if (document.readyState === 'loading') {
              document.addEventListener('DOMContentLoaded', init);
            } else {
              init();
            }

            // Also run periodically to catch any dynamically added resources
            setInterval(init, 1000);

            // Set up MutationObserver for dynamically added link and script elements
            const observer = new MutationObserver((mutations) => {
              mutations.forEach((mutation) => {
                if (mutation.type === 'childList') {
                  mutation.addedNodes.forEach((node) => {
                    if (node.nodeType === 1 && (node.tagName === 'LINK' || node.tagName === 'SCRIPT')) {
                      if (node.tagName === 'LINK') {
                        if ((node.rel === 'stylesheet' || node.rel === 'preload') && !node.hasAttribute('crossorigin')) {
                          node.setAttribute('crossorigin', 'anonymous');
                        }
                      } else if (node.tagName === 'SCRIPT') {
                        if (node.src && !node.hasAttribute('crossorigin')) {
                          node.setAttribute('crossorigin', 'anonymous');
                        }
                      }
                    }
                  });
                }
              });
            });

            observer.observe(document.documentElement, {
              childList: true,
              subtree: true
            });
          })();
        </script>
      `;
      return html.replace('</head>', `${script}</head>`);
    },
  };
}

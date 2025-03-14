interface EmbedProviderConfig {
  name: string;
  defaultHeight: number;
  defaultWidth?: number;
  generateHtml: (
    url: string,
    embedHtml?: string,
    isDark?: boolean,
    constrainHeight?: boolean
  ) => string;
  extractId?: (url: string) => string;
  getCustomStyles?: () => string;
}

const youtubeConfig: EmbedProviderConfig = {
  name: 'YouTube',
  defaultHeight: 180,
  defaultWidth: 320,
  extractId: (url: string) => url.split('v=')[1],
  generateHtml: (url: string) => {
    const videoId = url.split('v=')[1];
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
          <style>
            html, body { 
              margin: 0; 
              padding: 0; 
              background: transparent;
            }
            iframe {
              width: 100% !important;
              height: 180px !important;
              margin: 0 !important;
            }
          </style>
          <script>
            window.addEventListener('load', () => {
              window.ReactNativeWebView.postMessage(JSON.stringify({ 
                height: 180
              }));
            });
          </script>
        </head>
        <body>
          <iframe
            width="100%"
            height="100%"
            src="https://www.youtube.com/embed/${videoId}"
            frameborder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowfullscreen>
          </iframe>
        </body>
      </html>
    `;
  },
};

const spotifyConfig: EmbedProviderConfig = {
  name: 'Spotify',
  defaultHeight: 80,
  defaultWidth: 320,
  generateHtml: (url: string) => {
    const playlistOrTrack = url.split('/')[3];
    const id = url.split('/')?.pop()?.split('?')[0];
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
          <style>
            html, body { 
              margin: 0; 
              padding: 0; 
              background: transparent;
            }
            iframe {
              width: 100% !important;
              height: 80px !important;
              margin: 0 !important;
            }
          </style>
          <script>
            window.addEventListener('load', () => {
              window.ReactNativeWebView.postMessage(JSON.stringify({ 
                height: 80
              }));
            });
          </script>
        </head>
        <body>
          <iframe
            style="width: 100%; height: 100%;"
            src="https://open.spotify.com/embed/${playlistOrTrack}/${id}"
            frameBorder="0"
            allowFullScreen
            allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
          ></iframe>
        </body>
      </html>
    `;
  },
};

const twitterConfig: EmbedProviderConfig = {
  name: 'Twitter',
  defaultHeight: 300,
  defaultWidth: 300,
  generateHtml: (
    url: string,
    embedHtml?: string,
    isDark?: boolean,
    constrainHeight?: boolean
  ) => {
    if (!embedHtml) return '';
    // Add theme attribute to the blockquote element with theme adjustment
    const themedHtml = embedHtml.replace(
      '<blockquote class="twitter-tweet"',
      `<blockquote class="twitter-tweet" data-theme="${isDark ? 'dark' : 'light'}" ${constrainHeight ? "data-cards='hidden'" : ''}`
    );
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
          <style>
            html, body { 
              margin: 0; 
              padding: 0; 
              background: transparent;
            }
            .twitter-tweet { 
              margin: 0 !important;
            }
            iframe {
              width: 100% !important;
              margin: 0 !important;
            }
          </style>
          <script>
            let lastReportedHeight = 0;
            let heightStabilityCounter = 0;
            
            function checkForTwitterWidget() {
              const tweetFrame = document.querySelector('iframe[id^="twitter-widget"]');
              if (tweetFrame) {
                let hasReportedLoaded = false;
                
                const resizeObserver = new ResizeObserver((entries) => {
                  for (const entry of entries) {
                    const height = Math.round(entry.contentRect.height);
                    
                    // Report height when stable or on significant changes
                    if (Math.abs(height - lastReportedHeight) > 20 || height === lastReportedHeight) {
                      heightStabilityCounter++;
                      
                      if (heightStabilityCounter > 2 || Math.abs(height - lastReportedHeight) > 50) {
                        window.ReactNativeWebView.postMessage(JSON.stringify({ height }));
                        lastReportedHeight = height;
                        heightStabilityCounter = 0;
                      }
                    }
                    
                    if (!hasReportedLoaded && height > 0) {
                      window.ReactNativeWebView.postMessage(JSON.stringify({ 
                        height,
                        loaded: true
                      }));
                      hasReportedLoaded = true;
                      lastReportedHeight = height;
                    }
                  }
                });
                
                resizeObserver.observe(tweetFrame);
                
                const initialHeight = tweetFrame.offsetHeight;
                if (initialHeight > 0) {
                  window.ReactNativeWebView.postMessage(JSON.stringify({ 
                    height: initialHeight,
                    loaded: true
                  }));
                  hasReportedLoaded = true;
                  lastReportedHeight = initialHeight;
                }
              } else {
                setTimeout(checkForTwitterWidget, 100);
              }
            }
            
            window.addEventListener('load', () => {
              checkForTwitterWidget();
            });
          </script>
        </head>
        <body>
          ${themedHtml}
        </body>
      </html>
    `;
  },
};

const tiktokConfig: EmbedProviderConfig = {
  name: 'TikTok',
  defaultHeight: 700,
  defaultWidth: 320,
  extractId: (url: string) => url.split('/video/')[1]?.split('?')[0],
  generateHtml: (url: string) => {
    const videoId = url.split('/video/')[1]?.split('?')[0];
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
          <style>
            html, body { 
              margin: 0; 
              padding: 0; 
              background: transparent;
            }
            iframe {
              width: 100% !important;
              height: 700px !important;
              margin: 0 !important;
              border: none !important;
            }
          </style>
          <script>
            window.addEventListener('load', () => {
              window.ReactNativeWebView.postMessage(JSON.stringify({ 
                height: 700
              }));
            });
          </script>
        </head>
        <body>
          <iframe
            width="100%"
            height="700"
            src="https://www.tiktok.com/player/v1/${videoId}?autoplay=0&muted=1"
            frameborder="0"
            allow="clipboard-write"
            autoplay="0"
            allowfullscreen
          ></iframe>
        </body>
      </html>
    `;
  },
};

export const providers: Record<string, EmbedProviderConfig> = {
  YouTube: youtubeConfig,
  Spotify: spotifyConfig,
  Twitter: twitterConfig,
  TikTok: tiktokConfig,
};

export const getProviderConfig = (
  providerName?: string
): EmbedProviderConfig | undefined => {
  if (!providerName) return undefined;
  return providers[providerName];
};

export type { EmbedProviderConfig };

//
// (c) Lauritz Holtmann
//

const WEEK_IN_MS = 7 * 24 * 60 * 60 * 1000;

chrome.webNavigation.onCompleted.addListener((details) => {
  if (details?.tab?.url?.startsWith("chrome://")) return undefined;

  chrome.scripting.executeScript({
    target: { tabId: details.tabId },
    files: ['content.js']
  });
}, { url: [{ urlMatches: 'https?://*/*' }] });

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'checkDomains') {
    checkAndStoreDomains(message.domains, message.pageUrl);
  }
});

function checkAndStoreDomains(domains, pageUrl) {
  chrome.storage.local.get(['domains'], (result) => {
    let storedDomains = result.domains || {};
    const now = Date.now();

    // Clean up old entries
    for (let domain in storedDomains) {
      if (storedDomains[domain].timestamp < now - WEEK_IN_MS) {
        delete storedDomains[domain];
      }
    }

    domains.forEach(domain => {
      if (!storedDomains.hasOwnProperty(domain.domain)) {
        resolveDomain(domain.domain, (resolvable) => {
          storedDomains[domain.domain] = {
            timestamp: now,
            pageUrl: domain.pageUrl,
            sinkElement: domain.sinkElement
          };
          chrome.storage.local.set({ domains: storedDomains });
          if (!resolvable) {
            createNotification(`Domain not resolvable: ${domain.domain}\n\nFound on: ${domain.pageUrl}\n\nElement: ${domain.sinkElement}`);
          }
        });
      }
    });
  });
}

function resolveDomain(domain, callback) {
  if(domain.trim() != '') {
    fetch(`https://dns.google/resolve?name=${domain}`)
      .then(response => response.json())
      .then(data => {
        callback(data.Answer && data.Answer.length > 0);
      })
      .catch(() => {
        callback(false);
      });
  }
}

function createNotification(message) {
  chrome.notifications.create({
    type: 'basic',
    title: '🚨 Dead Domain Discovery 🚨',
    iconUrl: 'icons/icon48.png',
    message: message
  });
}

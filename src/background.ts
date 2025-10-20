import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api';
const API_TIMEOUT = Number(import.meta.env.VITE_API_TIMEOUT) || 10000;
const SYNC_INTERVAL = Number(import.meta.env.VITE_QUEUE_SYNC_INTERVAL) || 10000;

async function syncQueuedVisits() {
    const {visitQueue = []} = await chrome.storage.local.get(['visitQueue']);
    if (visitQueue.length === 0) return;
    try {
        const visits = visitQueue.map(({timestamp, ...v}: any) => v);
        await axios.post(`${API_BASE_URL}/visits/batch`, visits, {
            headers: {'Content-Type': 'application/json'},
            timeout: API_TIMEOUT,
        });
        await chrome.storage.local.remove(['visitQueue']);
    } catch (err) {
        console.error('Background sync failed:', err);
    }
}

setInterval(syncQueuedVisits, SYNC_INTERVAL);

async function getMetricsWithRetry(tabId: number, maxRetries = 3, delay = 500): Promise<any> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            const response = await new Promise((resolve, reject) => {
                chrome.tabs.sendMessage(tabId, {type: 'GET_METRICS'}, (response) => {
                    if (chrome.runtime.lastError) {
                        reject(chrome.runtime.lastError);
                    } else {
                        resolve(response);
                    }
                });
            });

            return response;
        } catch (error: any) {
            if (attempt < maxRetries) {
                await new Promise(resolve => setTimeout(resolve, delay * attempt));
            } else {
                throw error;
            }
        }
    }
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.type === 'PAGE_METRICS') {
        chrome.storage.local.set({
            lastMetrics: message.data,
            lastUpdate: Date.now(),
        });

        chrome.runtime.sendMessage(
            {
                type: 'METRICS_UPDATED',
                data: message.data,
            },
            () => {
                if (chrome.runtime.lastError) {
                    // Side panel might not be open - this is fine
                }
            }
        );
    }

    if (message.type === 'SYNC_QUEUE') {
        syncQueuedVisits().then(() => {
            chrome.runtime.sendMessage({type: 'QUEUE_SYNCED'}, () => {
                if (chrome.runtime.lastError) return;
            });
            sendResponse({success: true});
        });
        return true;
    }

    return true;
});

chrome.action.onClicked.addListener((tab) => {
    chrome.sidePanel.open({windowId: tab.windowId});
});

chrome.tabs.onActivated.addListener(async (activeInfo) => {
    const tab = await chrome.tabs.get(activeInfo.tabId);
    if (tab.url && !tab.url.startsWith('chrome://') && tab.status === 'complete') {
        try {
            const response = await getMetricsWithRetry(activeInfo.tabId, 3, 300);

            chrome.runtime.sendMessage(
                {
                    type: 'METRICS_UPDATED',
                    data: response,
                },
                () => {
                    if (chrome.runtime.lastError) {
                        // Side panel might not be open - this is fine
                    }
                }
            );
        } catch (error: any) {
            // Content script not available even after retries - this is expected for restricted pages
        }
    }
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tab.url && !tab.url.startsWith('chrome://')) {
        setTimeout(async () => {
            try {
                const response = await getMetricsWithRetry(tabId, 3, 400);
                chrome.runtime.sendMessage(
                    {
                        type: 'METRICS_UPDATED',
                        data: response,
                    },
                    () => {
                        if (chrome.runtime.lastError) {
                            // Side panel not listening
                        }
                    }
                );
            } catch (error: any) {
                // Content script not available after retries
            }
        }, 800);
    }
});


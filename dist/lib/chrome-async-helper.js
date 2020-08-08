const tabSendMessage = (tabId, message) => new Promise(resolve => {
    chrome.tabs.sendMessage(tabId, message, res => resolve(res));
});
const sendMessage = (message) => new Promise(resolve => {
    chrome.runtime.sendMessage(message, resolve);
});
const storage = {
    set(type, data) {
        return new Promise(resolve => {
            chrome.storage[type].set(data, resolve);
        });
    },
    remove(type, removeKey) {
        return new Promise(resolve => {
            chrome.storage[type].remove(removeKey, resolve);
        });
    },
};
const tabs = {
    executeScript(details) {
        return new Promise(resolve => {
            chrome.tabs.executeScript(details, resolve);
        });
    },
};
export default { tabSendMessage, sendMessage, storage, tabs };

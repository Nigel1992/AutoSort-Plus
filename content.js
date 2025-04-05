// Listen for messages from the background script
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "getSelectedMessages") {
        try {
            // Get the message list container
            const messageList = document.querySelector('#threadTree');
            if (!messageList) {
                console.error("Could not find message list");
                sendResponse([]);
                return true;
            }

            // Get selected rows
            const selectedRows = messageList.querySelectorAll('tr.selected');
            if (!selectedRows || selectedRows.length === 0) {
                console.log("No messages selected");
                sendResponse([]);
                return true;
            }

            // Extract message IDs
            const selectedMessages = Array.from(selectedRows).map(row => {
                // Try different possible ID attributes
                const messageId = row.getAttribute('data-message-id') || 
                                row.getAttribute('data-id') || 
                                row.getAttribute('id');
                
                if (!messageId) {
                    console.warn("Row missing message ID:", row);
                    return null;
                }
                
                // Clean up the ID if needed
                const cleanId = messageId.replace(/^msg-/i, '');
                return { id: cleanId };
            }).filter(msg => msg !== null);

            console.log("Found selected messages:", selectedMessages);
            sendResponse(selectedMessages);
        } catch (error) {
            console.error("Error getting selected messages:", error);
            sendResponse([]);
        }
    }
    return true;
}); 
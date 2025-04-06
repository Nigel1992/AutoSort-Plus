// Listen for messages from the options page
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "applyLabels") {
        applyLabelsToMessages(message.messages, message.label);
    } else if (message.action === "analyzeEmail") {
        analyzeEmailContent(message.emailContent).then(label => {
            sendResponse({ label: label });
        });
        return true; // Required for async response
    }
});

// Function to show notification
async function showNotification(title, message, type = "basic") {
    try {
        const id = `autosort-${Date.now()}`;
        await browser.notifications.create(id, {
            type: type,
            iconUrl: browser.runtime.getURL("icons/icon-48.png"),
            title: title,
            message: message,
            eventTime: Date.now(),
            priority: 2,
            requireInteraction: true  // This will make the notification stay until dismissed
        });
        return id;
    } catch (error) {
        console.error("Error showing notification:", error);
        // Fallback to console if notification fails
        console.log(`[AutoSort+] ${title}: ${message}`);
    }
}

// Function to update existing notification
async function updateNotification(id, title, message) {
    try {
        // Close the old notification
        await browser.notifications.clear(id);
        // Create a new notification
        return await showNotification(title, message);
    } catch (error) {
        console.error("Error updating notification:", error);
        // Fallback to console if notification fails
        console.log(`[AutoSort+] ${title}: ${message}`);
    }
}

// Function to analyze email content using Gemini
async function analyzeEmailContent(emailContent) {
    try {
        const notificationId = await showNotification(
            "AutoSort+ AI Analysis",
            "Starting email analysis..."
        );

        const settings = await browser.storage.local.get(['geminiApiKey', 'labels', 'enableAi']);
        console.log("Settings retrieved:", {
            hasApiKey: !!settings.geminiApiKey,
            labels: settings.labels,
            enableAi: settings.enableAi !== false
        });
        
        if (settings.enableAi === false || !settings.geminiApiKey || !settings.labels || settings.labels.length === 0) {
            console.error("Missing configuration");
            await updateNotification(
                notificationId,
                "AutoSort+ Error",
                "AI analysis is not properly configured. Please check your settings."
            );
            return null;
        }

        await updateNotification(
            notificationId,
            "AutoSort+ AI Analysis",
            "Sending request to Gemini AI..."
        );

        const prompt = `You are an email classification assistant. Analyze this email content and choose the most appropriate label from this list: ${settings.labels.join(', ')}. 
        Consider the following:
        1. The main topic and purpose of the email
        2. The sender and recipient context
        3. The urgency and importance of the content
        4. The type of communication (e.g., notification, request, update)
        
        Only respond with the exact label name that best fits the content. If no label fits well, respond with "null".
        
        Email content:
        ${emailContent}`;

        console.log("Making API request to Gemini...");
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${settings.geminiApiKey}`;
        console.log("API URL:", apiUrl);
        
        await updateNotification(
            notificationId,
            "AutoSort+ AI Analysis",
            "Analyzing email content with Gemini AI..."
        );

        const requestBody = {
            contents: [{
                parts: [{
                    text: prompt
                }]
            }],
            generationConfig: {
                temperature: 0.2,
                topK: 1,
                topP: 1,
                maxOutputTokens: 10
            }
        };
        console.log("Request body:", JSON.stringify(requestBody));

        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody)
        });

        console.log("API response status:", response.status);
        console.log("API response headers:", Object.fromEntries(response.headers.entries()));

        if (!response.ok) {
            const error = await response.json();
            console.error("API Error details:", error);
            let errorMessage = error.error?.message || 'Unknown error';
            
            // Handle quota errors specifically
            if (response.status === 429 || errorMessage.includes('quota') || errorMessage.includes('rate limit')) {
                errorMessage = "API quota exceeded. Please wait a while before trying again, or upgrade to a paid API key.";
            }
            
            await updateNotification(
                notificationId,
                "AutoSort+ Error",
                `API Error: ${errorMessage}`
            );
            return null;
        }

        await updateNotification(
            notificationId,
            "AutoSort+ AI Analysis",
            "Processing AI response..."
        );

        const data = await response.json();
        const label = data.candidates[0].content.parts[0].text.trim();
        console.log("Generated label:", label);
        
        // Verify the label exists in our list
        if (settings.labels.includes(label)) {
            await updateNotification(
                notificationId,
                "AutoSort+ Success",
                `AI analysis complete. Selected label: ${label}`
            );
            return label;
        } else {
            console.log("Label not found in configured labels");
            await updateNotification(
                notificationId,
                "AutoSort+ Warning",
                "AI analysis complete but no matching label found."
            );
            return null;
        }
    } catch (error) {
        console.error("Error analyzing email:", error);
        await showNotification(
            "AutoSort+ Error",
            `Error analyzing email: ${error.message}`
        );
        return null;
    }
}

// Function to store move history
async function storeMoveHistory(result) {
    try {
        const data = await browser.storage.local.get('moveHistory');
        const history = data.moveHistory || [];
        history.unshift({
            timestamp: new Date().toISOString(),
            ...result
        });
        // Keep only the last 100 entries
        if (history.length > 100) {
            history.pop();
        }
        await browser.storage.local.set({ moveHistory: history });
    } catch (error) {
        console.error("Error storing move history:", error);
    }
}

// Function to apply labels to selected messages
async function applyLabelsToMessages(messages, label) {
    try {
        const messageCount = messages.length;
        const notificationId = await showNotification(
            "AutoSort+ Processing",
            `Starting to process ${messageCount} message(s)...`
        );
        
        let successCount = 0;
        let errorCount = 0;
        const moveResults = [];

        for (const message of messages) {
            console.log("Processing message:", message.id);
            console.log("Target label/folder:", label);
            
            // Get all folders to find the destination folder
            const account = await browser.accounts.get(message.folder.accountId);
            console.log("Account info:", account);

            await updateNotification(
                notificationId,
                "AutoSort+ Processing",
                `Finding destination folder for message ${successCount + errorCount + 1}/${messageCount}...`
            );

            // Find the folder with matching name
            const findFolder = (folders, targetName) => {
                for (const folder of folders) {
                    console.log("Checking folder:", folder.name);
                    if (folder.name === targetName) {
                        return folder;
                    }
                    if (folder.subFolders) {
                        const found = findFolder(folder.subFolders, targetName);
                        if (found) return found;
                    }
                }
                return null;
            };

            // First try to find the category folder
            const categories = [
                "Financiën",
                "Werk en Carrière",
                "Persoonlijke Communicatie en Sociale Leven",
                "Gezondheid en Welzijn",
                "Online Activiteiten en E-commerce",
                "Reizen en Evenementen",
                "Informatie en Media",
                "Beveiliging en IT",
                "Klantensupport en Acties",
                "Overheid en Gemeenschap"
            ];

            let categoryFolder = null;
            let targetFolder = null;

            // Find the category and target folder
            for (const category of categories) {
                if (label.startsWith(category)) {
                    console.log("Found matching category:", category);
                    categoryFolder = findFolder(account.folders, category);
                    if (categoryFolder) {
                        console.log("Found category folder:", categoryFolder.name);
                        // Try to find the subfolder
                        const subfolderName = label.replace(category + "/", "");
                        console.log("Looking for subfolder:", subfolderName);
                        targetFolder = findFolder(categoryFolder.subFolders || [], subfolderName);
                        break;
                    }
                }
            }

            // If no target folder found, try direct match
            if (!targetFolder) {
                console.log("No category match found, trying direct folder match");
                targetFolder = findFolder(account.folders, label);
            }

            console.log("Moving message to folder:", targetFolder ? targetFolder.name : "not found");

            try {
                if (!targetFolder) {
                    console.error(`Folder "${label}" not found in account ${account.name}`);
                    await updateNotification(
                        notificationId,
                        "AutoSort+ Error",
                        `Folder "${label}" not found. Please create it first in Thunderbird.`
                    );
                    errorCount++;
                    const result = {
                        subject: message.subject || "(No subject)",
                        status: "Error",
                        destination: "Folder not found",
                        timestamp: new Date().toISOString()
                    };
                    moveResults.push(result);
                    await storeMoveHistory(result);
                    continue;
                }

                await updateNotification(
                    notificationId,
                    "AutoSort+ Processing",
                    `Moving message ${successCount + errorCount + 1}/${messageCount} to ${targetFolder.name}...`
                );

                // Move the message using the folder ID
                await browser.messages.move(
                    [message.id], 
                    targetFolder.id
                );
                
                successCount++;
                const result = {
                    subject: message.subject || "(No subject)",
                    status: "Success",
                    destination: targetFolder.name,
                    timestamp: new Date().toISOString()
                };
                moveResults.push(result);
                await storeMoveHistory(result);
            } catch (moveError) {
                console.error("Error moving message:", moveError);
                errorCount++;
                const result = {
                    subject: message.subject || "(No subject)",
                    status: "Error",
                    destination: moveError.message,
                    timestamp: new Date().toISOString()
                };
                moveResults.push(result);
                await storeMoveHistory(result);
                await updateNotification(
                    notificationId,
                    "AutoSort+ Error",
                    `Error moving message: ${moveError.message}`
                );
            }
        }

        // Show final status
        if (errorCount === 0) {
            await updateNotification(
                notificationId,
                "AutoSort+ Success",
                `Successfully moved ${successCount} message(s) to ${label}`
            );
        } else {
            await updateNotification(
                notificationId,
                "AutoSort+ Completed with Errors",
                `Processed ${messageCount} message(s): ${successCount} successful, ${errorCount} failed`
            );
        }

        // Create and show the results popup
        await showMoveResultsPopup(moveResults);
    } catch (error) {
        console.error("Error applying labels:", error);
        await showNotification(
            "AutoSort+ Error",
            `Error processing messages: ${error.message}`
        );
    }
}

// Function to create and show the move results popup
async function showMoveResultsPopup(results) {
    try {
        const successCount = results.filter(r => r.status === "Success").length;
        const errorCount = results.filter(r => r.status === "Error").length;
        
        // Create a detailed message
        let message = `Processed ${results.length} messages:\n`;
        message += `✅ Successfully moved: ${successCount}\n`;
        message += `❌ Failed to move: ${errorCount}\n\n`;
        
        // Add details for each message
        results.forEach((result, index) => {
            message += `${index + 1}. ${result.subject}\n`;
            message += `   Status: ${result.status}\n`;
            message += `   Destination: ${result.destination}\n`;
            message += `   Timestamp: ${result.timestamp}\n\n`;
        });

        // Show the notification with higher priority and require interaction
        await showNotification(
            "AutoSort+ Results",
            message,
            "basic"
        );

        // Also log to console for debugging
        console.log("[AutoSort+] Results:", message);
    } catch (error) {
        console.error("Error showing results:", error);
        await showNotification(
            "AutoSort+ Error",
            "Failed to show detailed results. Check console for more information."
        );
    }
}

// Create context menu items
browser.menus.create({
    id: "autosort-label",
    title: "AutoSort+ Label",
    contexts: ["message_list"]
});

// Add submenu items for labels
browser.storage.local.get(['labels']).then(result => {
    if (result.labels) {
        result.labels.forEach(label => {
            browser.menus.create({
                id: `label-${label}`,
                parentId: "autosort-label",
                title: label,
                contexts: ["message_list"]
            });
        });
    }
});

// Add AI analysis option
browser.menus.create({
    id: "autosort-analyze",
    title: "AutoSort+ Analyze with AI",
    contexts: ["message_list"]
});

// Listen for menu clicks
browser.menus.onClicked.addListener(async (info, tab) => {
    if (info.parentMenuItemId === "autosort-label") {
        const label = info.menuItemId.replace("label-", "");
        console.log(`Manual label selected: ${label}`);
        await showNotification("AutoSort+", `Applying label: ${label}`);
        browser.tabs.sendMessage(tab.id, {
            action: "getSelectedMessages",
            label: label
        });
    } else if (info.menuItemId === "autosort-analyze") {
        console.log("AI analysis selected - starting process");
        await showNotification("AutoSort+", "Starting AI analysis of selected messages...");
        
        try {
            // Get the current mail tab
            const mailTabs = await browser.mailTabs.query({ active: true, currentWindow: true });
            if (!mailTabs || mailTabs.length === 0) {
                console.error("No active mail tab found");
                await showNotification("AutoSort+ Error", "No active mail tab found");
                return;
            }
            console.log("Current mail tab:", mailTabs[0]);

            // Get selected messages using mailTabs API
            const selectedMessageList = await browser.mailTabs.getSelectedMessages(mailTabs[0].id);
            console.log("Selected message list:", selectedMessageList);

            if (!selectedMessageList || !selectedMessageList.messages || selectedMessageList.messages.length === 0) {
                console.error("No messages selected");
                await showNotification("AutoSort+ Error", "No messages selected for analysis");
                return;
            }

            console.log(`Analyzing ${selectedMessageList.messages.length} selected messages`);
            
            for (const message of selectedMessageList.messages) {
                // Get the full message with body
                const fullMessage = await browser.messages.getFull(message.id);
                console.log("Got full message:", fullMessage ? "yes" : "no");
                console.log("Message content:", fullMessage);

                if (!fullMessage) {
                    console.error("Could not get message content");
                    continue;
                }

                // Function to recursively extract text from message parts
                function extractTextFromParts(parts) {
                    let text = "";
                    if (!parts) return text;

                    for (const part of parts) {
                        console.log("Processing part:", {
                            contentType: part.contentType,
                            partName: part.partName,
                            size: part.size
                        });

                        if (part.parts) {
                            // Recursively process nested parts
                            text += extractTextFromParts(part.parts);
                        }
                        
                        if (part.contentType === "text/plain") {
                            text += part.body + "\n";
                        } else if (part.contentType === "text/html" && !text) {
                            // Only use HTML if we haven't found plain text
                            text = browser.messengerUtilities.convertToPlainText(part.body);
                        } else if (part.contentType === "message/rfc822" && part.body) {
                            // Handle message/rfc822 parts
                            text += part.body + "\n";
                        }
                    }
                    return text;
                }

                // Extract email content from the message
                let emailContent = "";
                if (fullMessage.parts) {
                    emailContent = await extractTextFromParts(fullMessage.parts);
                } else if (fullMessage.body) {
                    emailContent = fullMessage.body;
                }

                console.log("Extracted email content:", emailContent || "<empty string>");

                if (!emailContent) {
                    console.error("No readable content found in message");
                    await showNotification("AutoSort+ Error", "Could not extract email content");
                    continue;
                }

                console.log("Analyzing message content");
                const label = await analyzeEmailContent(emailContent);
                
                if (label) {
                    console.log("Applying label:", label);
                    await applyLabelsToMessages([message], label);
                    await showNotification("AutoSort+", `Successfully applied label: ${label}`);
                } else {
                    console.log("No label generated from analysis");
                    await showNotification("AutoSort+ Error", "Could not generate label from analysis");
                }
            }
        } catch (error) {
            console.error("Error during AI analysis:", error);
            await showNotification("AutoSort+ Error", `Error: ${error.message}`);
        }
    }
}); 
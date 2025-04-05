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
            priority: 2
        });
        return id;
    } catch (error) {
        console.error("Error showing notification:", error);
    }
}

// Function to update existing notification
async function updateNotification(id, title, message) {
    try {
        await browser.notifications.update(id, {
            title: title,
            message: message
        });
    } catch (error) {
        console.error("Error updating notification:", error);
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
            enableAi: settings.enableAi
        });
        
        if (!settings.enableAi || !settings.geminiApiKey || !settings.labels || settings.labels.length === 0) {
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
        console.log("API URL:", 'https://generativelanguage.googleapis.com/v1/models/gemini-1.0-pro:generateContent');
        
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

        const response = await fetch('https://generativelanguage.googleapis.com/v1/models/gemini-1.0-pro:generateContent', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-goog-api-key': settings.geminiApiKey
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

// Function to apply labels to selected messages
async function applyLabelsToMessages(messages, label) {
    try {
        const settings = await browser.storage.local.get(['bulkMove']);
        const messageCount = messages.length;
        const notificationId = await showNotification(
            "AutoSort+ Processing",
            `Starting to process ${messageCount} message(s)...`
        );
        
        let successCount = 0;
        let errorCount = 0;

        for (const message of messages) {
            if (settings.bulkMove) {
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
                        categoryFolder = findFolder(account.folders, category);
                        if (categoryFolder) {
                            // Try to find the subfolder
                            const subfolderName = label.replace(category + "/", "");
                            targetFolder = findFolder(categoryFolder.subFolders || [], subfolderName);
                            break;
                        }
                    }
                }

                // If no target folder found, try direct match
                if (!targetFolder) {
                    targetFolder = findFolder(account.folders, label);
                }

                console.log("Moving message to folder:", targetFolder);

                try {
                    if (!targetFolder) {
                        console.error(`Folder "${label}" not found in account ${account.name}`);
                        await updateNotification(
                            notificationId,
                            "AutoSort+ Error",
                            `Folder "${label}" not found. Please create it first in Thunderbird.`
                        );
                        errorCount++;
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
                    console.log(`Moved message ${message.id} to folder ${targetFolder.name} (${targetFolder.id})`);
                } catch (moveError) {
                    console.error("Error moving message:", moveError);
                    errorCount++;
                    await updateNotification(
                        notificationId,
                        "AutoSort+ Error",
                        `Error moving message: ${moveError.message}`
                    );
                }
            } else {
                // Add the tag to the message
                try {
                    await updateNotification(
                        notificationId,
                        "AutoSort+ Processing",
                        `Applying tag to message ${successCount + errorCount + 1}/${messageCount}...`
                    );

                    const currentTags = message.tags || [];
                    if (!currentTags.includes(label)) {
                        const newTags = [...currentTags, label];
                        await browser.messages.setTags(message.id, newTags);
                        successCount++;
                        console.log(`Added tag ${label} to message ${message.id}`);
                    } else {
                        successCount++;
                        console.log(`Message ${message.id} already has tag ${label}`);
                    }
                } catch (tagError) {
                    errorCount++;
                    console.error("Error applying tag:", tagError);
                }
            }
        }

        // Show final status
        const action = settings.bulkMove ? 'moved' : 'tagged';
        if (errorCount === 0) {
            await updateNotification(
                notificationId,
                "AutoSort+ Success",
                `Successfully ${action} ${successCount} message(s) with ${label}`
            );
        } else {
            await updateNotification(
                notificationId,
                "AutoSort+ Completed with Errors",
                `Processed ${messageCount} message(s): ${successCount} successful, ${errorCount} failed`
            );
        }
    } catch (error) {
        console.error("Error applying labels:", error);
        await showNotification(
            "AutoSort+ Error",
            `Error processing messages: ${error.message}`
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

document.addEventListener('DOMContentLoaded', () => {
    const extractBtn = document.getElementById('extractBtn');
    const output = document.getElementById('output');
    const status = document.getElementById('status');
    const copyBtn = document.getElementById('copyBtn');
    const rangeOptions = document.getElementsByName('range');
    const customInputs = document.getElementById('customInputs');
    const startDateInput = document.getElementById('start_date');
    const endDateInput = document.getElementById('end_date');
    const resumeCheckbox = document.getElementById('resume_checkbox');
    const lastRunInfo = document.getElementById('last_run_info');

    // Restore state
    chrome.storage.local.get(['lastRunDate', 'lastRunType'], (result) => {
        if (result.lastRunDate) {
            const date = new Date(result.lastRunDate);
            lastRunInfo.textContent = `(Last: ${date.toLocaleString()})`;
            resumeCheckbox.dataset.lastDate = result.lastRunDate;
        } else {
            resumeCheckbox.disabled = true;
            resumeCheckbox.parentElement.title = "No previous run found";
        }
    });

    // UI Event Listeners
    Array.from(rangeOptions).forEach(radio => {
        radio.addEventListener('change', (e) => {
            if (e.target.value === 'custom') {
                customInputs.style.display = 'block';
            } else {
                customInputs.style.display = 'none';
            }
            updateResumeState();
        });
    });

    resumeCheckbox.addEventListener('change', updateResumeState);

    function updateResumeState() {
        if (resumeCheckbox.checked) {
            // Disable specific range stuff visally or just logic?
            // Logic priority: if resume is checked, start date is override.
        }
    }

    extractBtn.addEventListener('click', async () => {
        const selectedRange = Array.from(rangeOptions).find(r => r.checked).value;
        let start, end;

        status.textContent = "Calculating execution plan...";
        extractBtn.disabled = true;

        try {
            const now = new Date();
            end = new Date(now); // Default end is now

            if (resumeCheckbox.checked && resumeCheckbox.dataset.lastDate) {
                // Resume mode
                start = new Date(resumeCheckbox.dataset.lastDate);
                // Maybe add 1 second to avoid duplicates if strict?
                // Or just overlap. Overlap is safer.
                status.textContent = `Resuming from ${start.toLocaleString()}...`;
            } else {
                // Range mode
                const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

                switch (selectedRange) {
                    case 'today':
                        start = today;
                        break;
                    case 'yesterday':
                        start = new Date(today);
                        start.setDate(today.getDate() - 1);
                        end = new Date(today); // End at start of today (midnight) => effectively yesterday full day if we treat end as exclusive?
                        // Actually, for "Yesterday", usually means 00:00 to 23:59 yesterday.
                        // If end is 'now', we get yesterday + today.
                        // Let's define end strictly for past ranges.
                        end = today;
                        break;
                    case 'this_week': // From Monday
                        start = new Date(today);
                        const day = start.getDay() || 7; // Get current day number, converting Sun (0) to 7
                        if (day !== 1) start.setHours(-24 * (day - 1));
                        break;
                    case 'last_week':
                        // Last week Monday to last week Sunday
                        const lastSunday = new Date(today);
                        lastSunday.setDate(today.getDate() - (today.getDay() || 7));
                        end = new Date(lastSunday);
                        end.setHours(23, 59, 59, 999); // End of last Sunday

                        start = new Date(end);
                        start.setDate(end.getDate() - 6);
                        start.setHours(0, 0, 0, 0); // Start of last Monday
                        break;
                    case 'this_month':
                        start = new Date(now.getFullYear(), now.getMonth(), 1);
                        break;
                    case 'last_month':
                        start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                        end = new Date(now.getFullYear(), now.getMonth(), 0); // Last day of prev month
                        end.setHours(23, 59, 59, 999);
                        break;
                    case 'custom':
                        if (!startDateInput.value) {
                            throw new Error("Start date is required for custom range");
                        }
                        start = new Date(startDateInput.value);
                        if (endDateInput.value) {
                            end = new Date(endDateInput.value);
                            end.setHours(23, 59, 59, 999);
                        }
                        break;
                }
            }

            // Send to content script
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (!tab) throw new Error("No active tab found");

            // Store this run as last run (optimistic or wait for success?)
            // We should wait for success, but let's just trigger.

            status.textContent = `Injecting script...`;

            try {
                // Ping content script to see if it's there
                await chrome.tabs.sendMessage(tab.id, { action: "PING" });
            } catch (e) {
                // If ping fails, we might need to inject? 
                // But we added to manifest, so it should be there if we refreshed.
                // If we didn't refresh, we need to inject.
                await chrome.scripting.executeScript({
                    target: { tabId: tab.id },
                    files: ['content.js']
                });
            }

            status.textContent = `Starting extraction from ${start.toLocaleString()} to ${end ? end.toLocaleString() : 'Now'}...`;

            chrome.tabs.sendMessage(tab.id, {
                action: "EXTRACT",
                start: start.toISOString(),
                end: end.toISOString()
            }, (response) => {
                if (chrome.runtime.lastError) {
                    status.textContent = "Error: " + chrome.runtime.lastError.message;
                    extractBtn.disabled = false;
                    return;
                }

                // Response might be immediate or we might need to listen for updates.
                // Since scraping takes time, we should use runtime.onMessage for updates.
            });

        } catch (err) {
            status.textContent = "Error: " + err.message;
            extractBtn.disabled = false;
        }
    });

    // Listen for messages from content script
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.action === "UPDATE_STATUS") {
            status.textContent = request.message;
        } else if (request.action === "COMPLETE") {
            output.value = request.data;
            status.textContent = `Completed! Found ${request.count} tweets.`;
            extractBtn.disabled = false;
            copyBtn.classList.remove('hidden');

            // Save last run time
            chrome.storage.local.set({
                lastRunDate: new Date().toISOString()
            });

            // Re-read to update UI
            chrome.storage.local.get(['lastRunDate'], (res) => {
                const date = new Date(res.lastRunDate);
                lastRunInfo.textContent = `(Last: ${date.toLocaleString()})`;
                resumeCheckbox.dataset.lastDate = res.lastRunDate;
                resumeCheckbox.disabled = false;
            });
        } else if (request.action === "ERROR") {
            status.textContent = "Error: " + request.message;
            extractBtn.disabled = false;
        }
    });

    copyBtn.addEventListener('click', () => {
        output.select();
        document.execCommand('copy');
        const originalText = copyBtn.textContent;
        copyBtn.textContent = "Copied!";
        setTimeout(() => copyBtn.textContent = originalText, 1500);
    });
});

(function() {
    const PLACEHOLDER = "YOUR_USERNAME";
    const STORAGE_KEY = "mkdocs_user_username";

    // 1. Initialization: Find blocks containing the placeholder and store their original state.
    // This is crucial so we can swap names back and forth without losing the original placeholder position.
    function initCodeBlocks() {
        // Select all code blocks. In MkDocs, these are usually <pre><code>...</code></pre>
        const codeBlocks = document.querySelectorAll('pre code');

        codeBlocks.forEach(block => {
            if (block.textContent.includes(PLACEHOLDER) && !block.hasAttribute('data-original-content')) {
                // Store the original content in a data attribute
                block.setAttribute('data-original-content', block.textContent);
            }
        });
    }

    // 2. The Replacement Logic
    function updateCodeBlocks(username) {
        // If username is empty or null, revert to placeholder, otherwise use username
        const replacement = username && username.trim() !== '' ? username : PLACEHOLDER;

        // Use Regex with 'g' flag to replace all occurrences
        const regex = new RegExp(PLACEHOLDER, 'g');

        // Find only the blocks we previously identified as having placeholders
        const targetBlocks = document.querySelectorAll('pre code[data-original-content]');

        targetBlocks.forEach(block => {
            // Always start from the original content
            const original = block.getAttribute('data-original-content');
            // Perform replacement
            block.textContent = original.replace(regex, replacement);

            // IMPORTANT: Re-trigger syntax highlighting if using Material theme
            // Otherwise, the colors will disappear after replacement.
            if (window.hljs) {
                hljs.highlightElement(block);
            }
        });
    }

    // 3. Handle User Input
    function setupEventListeners() {
        const inputField = document.getElementById('user-username-input');
        const saveButton = document.getElementById('user-username-save');
        const clearButton = document.getElementById('user-username-clear');

        if (!inputField || !saveButton) return; // Elements might not exist on every page

        // Load currently saved username into the input box
        const savedUsername = localStorage.getItem(STORAGE_KEY);
        if (savedUsername) {
            inputField.value = savedUsername;
        }

        // Save action
        saveButton.addEventListener('click', function() {
            const val = inputField.value;
            if(val) {
                localStorage.setItem(STORAGE_KEY, val);
                updateCodeBlocks(val);
            }
        });

        // Clear action
        if(clearButton) {
            clearButton.addEventListener('click', function() {
                localStorage.removeItem(STORAGE_KEY);
                inputField.value = "";
                updateCodeBlocks(null); // Reverts to placeholder
            });
        }
    }


    // 4. Main Execution on Page Load
    document.addEventListener("DOMContentLoaded", function() {
        // Initialize blocks first
        initCodeBlocks();

        // Setup the UI input listeners
        setupEventListeners();

        // Apply existing username if one exists in storage
        const savedUsername = localStorage.getItem(STORAGE_KEY);
        if (savedUsername) {
            updateCodeBlocks(savedUsername);
        }
    });

    // 5. Handle navigation in Single Page App (SPA) mode (common in Material theme)
    // The DOM content changes without a full page reload, so we need to re-run logic.
    // We listen to the custom location change event used by Material theme.
    if (window.location$) {
        window.location$.subscribe(function() {
            // Give the new page content a moment to render
            setTimeout(function() {
               initCodeBlocks();
               // Re-apply saved username to the new page content
               const savedUsername = localStorage.getItem(STORAGE_KEY);
               if (savedUsername) {
                   updateCodeBlocks(savedUsername);
               }
               // Re-hook event listeners for input box if it exists on new page
               setupEventListeners();
            }, 100);
        });
    }

})();

import * as UserMessages from "../lang/messages/en/user.js";

class Message {
    static messageCount = 0;
    static saveTimeout = null; // For debouncing saves
    static SAVE_INTERVAL = 2000; // 2 seconds
    static unsavedNotes = new Set(); // Track which notes need saving
    
    constructor(id, text = "") {
        this.id = id;
        this.str = text;
        this.key = UserMessages.msg_key + " " + id;
    }

    static createMessage() {
        const container = document.getElementById('container');

        const messageId = Message.messageCount++;
        const msg = new Message(messageId, "");

        const wrapper = document.createElement('div');
        wrapper.className = 'message-wrapper';
        wrapper.dataset.id = messageId;
        
        const textarea = document.createElement('textarea');
        textarea.className = 'dynamic-textarea';
        textarea.placeholder = 'Type your message here...';
        textarea.dataset.id = messageId;
        
        const removeButton = document.createElement('button');
        removeButton.textContent = 'Remove';
        removeButton.className = 'remove-button';
        
        textarea.addEventListener('input', () => {
            msg.str = textarea.value;
            Message.unsavedNotes.add(messageId);
            // Debounce the save
            Message.debounceSave();
            Message.updateLastSavedTime();
        });
        
        removeButton.addEventListener('click', () => {
            msg.removeFromLocalStorage();
            wrapper.remove();
            Message.unsavedNotes.delete(messageId);
            Message.updateLastSavedTime();
        });
        
        wrapper.appendChild(textarea);
        wrapper.appendChild(removeButton);
        container.appendChild(wrapper);
        
        return wrapper;
    }

    static displayExistingMessages() {
        if (typeof (Storage) === "undefined") {
            console.log(UserMessages.msg_notSupported);
            return;
        }

        const container = document.getElementById('container');
        if (!container) {
            console.error("Container element not found!");
            return;
        }

        // Iterate through localStorage and find all messages
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith(UserMessages.msg_key)) {
                const msg = localStorage.getItem(key);
                
                // Extract ID from key
                const idStr = key.replace(UserMessages.msg_key + " ", "");
                const noteId = parseInt(idStr);
                
                if (noteId >= Message.messageCount) {
                    Message.messageCount = noteId + 1;
                }
                
                Message.createNewMessage(noteId, msg);
            }
        }
    }

    static createNewMessage(id, text) {
        const container = document.getElementById('container');
        if (!container) return;

        const msg = new Message(id, text);

        const wrapper = document.createElement('div');
        wrapper.className = 'message-wrapper';
        wrapper.dataset.id = id;
        
        const textarea = document.createElement('textarea');
        textarea.className = 'dynamic-textarea';
        textarea.placeholder = 'Type your message here...';
        textarea.value = text;
        textarea.dataset.id = id;
        
        const removeButton = document.createElement('button');
        removeButton.textContent = 'Remove';
        removeButton.className = 'remove-button';
        
        textarea.addEventListener('input', () => {
            msg.str = textarea.value;
            Message.unsavedNotes.add(id);
            Message.debounceSave();
            Message.timeStamp();
        });
        
        removeButton.addEventListener('click', () => {
            msg.removeFromLocalStorage();
            Message.unsavedNotes.delete(id);
            wrapper.remove();
            Message.updateLastSavedTime();
        });
        
        wrapper.appendChild(textarea);
        wrapper.appendChild(removeButton);
        container.appendChild(wrapper);
    }

    static debounceSave() {
        // Clear existing timeout
        if (Message.saveTimeout) {
            clearTimeout(Message.saveTimeout);
        }
        
        // Set new timeout to save after SAVE_INTERVAL
        Message.saveTimeout = setTimeout(() => {
            Message.saveAllNotes();
        }, Message.SAVE_INTERVAL);
    }

    static saveAllNotes() {
        if (typeof (Storage) !== "undefined") {
            Message.unsavedNotes.forEach(noteId => {
                const textarea = document.querySelector(`textarea[data-id="${noteId}"]`);
                if (textarea) {
                    const key = UserMessages.msg_key + " " + noteId;
                    localStorage.setItem(key, textarea.value);
                }
            });
            Message.unsavedNotes.clear();
            console.log("Dirty notes saved to localStorage");
            Message.timeStamp();
        } else {
            console.log(UserMessages.msg_notSupported);
        }
    }

    removeFromLocalStorage() {
        if (typeof (Storage) !== "undefined") {
            if (localStorage.getItem(this.key)) {
                localStorage.removeItem(this.key);
                console.log("Note " + this.key + " removed from localStorage");
            } else {
                console.warn("Key " + this.key + " not found in localStorage");
            }
        } else {
            console.log(UserMessages.msg_notSupported);
        }
    }

    static updateLastSavedTime() {
        const timestamp = new Date().toLocaleString();
        const timeDisplay = document.getElementById('last-saved-time');
        if (timeDisplay) {
            timeDisplay.textContent = 'Last saved: ' + timestamp;
        }
        // Also store in localStorage
        localStorage.setItem('last_saved_timestamp', timestamp);
    }

    static setupCrossTabSync() {
        // Listen for storage changes from other tabs
        window.addEventListener('storage', (event) => {
            if (event.key && event.key.startsWith(UserMessages.msg_key)) {
                console.log("Note updated from another tab: " + event.key);
                
                if (event.newValue === null) {
                    // Note was deleted
                    const idStr = event.key.replace(UserMessages.msg_key + " ", "");
                    const noteId = parseInt(idStr);
                    const wrapper = document.querySelector(`[data-id="${noteId}"]`);
                    if (wrapper) {
                        wrapper.remove();
                    }
                } else {
                    // Note was updated
                    const textarea = document.querySelector(`textarea[data-key="${event.key}"]`);
                    if (textarea) {
                        textarea.value = event.newValue;
                    } else {
                        // If textarea doesn't exist, it might be a new note, so reload
                        const idStr = event.key.replace(UserMessages.msg_key + " ", "");
                        const noteId = parseInt(idStr);
                        Message.displayReadOnly(noteId, event.newValue);
                    }
                }
                Message.timeStamp();
            }
        });
    }

    static displayReadOnly(noteId, noteContent) {
        const container = document.getElementById('container');
        if (!container) return;

        // Check if note already displayed
        const existingWrapper = document.querySelector(`[data-id="${noteId}"]`);
        if (existingWrapper) {
            const display = existingWrapper.querySelector('.note-display');
            if (display) {
                display.textContent = noteContent;
            }
            return;
        }

        const wrapper = document.createElement('div');
        wrapper.className = 'message-wrapper';
        wrapper.dataset.id = noteId;
        
        const noteDisplay = document.createElement('div');
        noteDisplay.className = 'note-display';
        noteDisplay.textContent = noteContent;
        
        wrapper.appendChild(noteDisplay);
        container.appendChild(wrapper);
    }

    static loadMessages() {
        if (typeof (Storage) === "undefined") {
            console.log(UserMessages.msg_notSupported);
            return;
        }

        const container = document.getElementById('container');
        if (!container) {
            console.error("Container element not found!");
            return;
        }

        // Collect all notes with their IDs
        const notes = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            // Check if key matches the message key pattern
            if (key && key.startsWith(UserMessages.msg_key)) {
                const noteContent = localStorage.getItem(key);
                
                // Extract ID from key
                const idStr = key.replace(UserMessages.msg_key + " ", "");
                const noteId = parseInt(idStr);
                
                notes.push({
                    id: noteId,
                    content: noteContent,
                    key: key
                });
            }
        }

        // Sort notes by ID in ascending order (order they were created)
        notes.sort((a, b) => a.id - b.id);

        notes.forEach(note => {
            Message.displayReadOnly(note.id, note.content);
        });
    }

    static timeStamp() {
        const timestamp = new Date().toLocaleString();
        const timeDisplay = document.getElementById('last-updated-time');
        if (timeDisplay) {
            timeDisplay.textContent = 'Last updated: ' + timestamp;
        }
    }
}

// Expose Message class to global scope for onclick handlers
window.Message = Message;

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    // Detect which page is loaded based on button presence
    const isWriterPage = document.querySelector('button[onclick*="createMessage"]') !== null;
    
    if (isWriterPage) {
        // Writer page initialization
        Message.displayExistingMessages();
        Message.setupCrossTabSync();
        Message.updateLastSavedTime();
    } else {
        // Reader page initialization
        Message.loadMessages();
        Message.setupCrossTabSync();
        Message.timeStamp();
    }
});


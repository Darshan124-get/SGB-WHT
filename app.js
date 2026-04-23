/**
 * Frontend logic for WhatsApp Admin Dashboard
 * Premium Responsive Version
 */

// Configuration: Point to your backend server
const API_BASE_URL = 'https://darksalmon-ibex-936777.hostingersite.com';

let activeCustomer = null;
let currentHistory = [];

const appContainerEl = document.getElementById('app-container');
const customerListEl = document.getElementById('customer-list');
const chatWelcomeEl = document.getElementById('chat-welcome');
const chatWindowEl = document.getElementById('chat-window');
const messageContainerEl = document.getElementById('message-container');
const messageInputEl = document.getElementById('message-input');
const sendBtnEl = document.getElementById('send-btn');
const activeCustomerNameEl = document.getElementById('active-customer-name');
const activeCustomerPhoneEl = document.getElementById('active-customer-phone');
const mobileBackBtnEl = document.getElementById('mobile-back-btn');
const activeAvatarEl = document.getElementById('active-avatar');
const attachBtnEl = document.getElementById('attach-btn');
const cameraBtnEl = document.getElementById('camera-btn');
const mediaInputEl = document.getElementById('media-input');

/**
 * Initialize
 */
document.addEventListener('DOMContentLoaded', () => {
    loadCustomers();
    
    // Refresh customer list every 30 seconds
    setInterval(loadCustomers, 30000);
    
    // Polling for new messages in active chat
    setInterval(() => {
        if (activeCustomer) {
            loadChatHistory(activeCustomer.phone, true);
        }
    }, 5000);
});

/**
 * Avatar Generator: Colors based on phone number
 */
function getAvatarStyle(phone) {
    if (!phone) return '#666'; // Fallback for undefined phone
    const colors = [
        '#00a884', '#128c7e', '#34b7f1', '#e53935', 
        '#d81b60', '#8e24aa', '#5e35b1', '#3949ab', 
        '#1e88e5', '#039be5', '#00acc1', '#00897b'
    ];
    // Simple hash of digits
    const sum = phone.split('').reduce((a, b) => a + (parseInt(b) || 0), 0);
    return colors[sum % colors.length];
}

function getInitials(name) {
    if (!name || name === '?') return '?';
    const parts = name.split(' ').filter(n => n);
    if (parts.length === 0) return '?';
    return parts.map(n => n[0]).join('').toUpperCase().substring(0, 2);
}

/**
 * Fetch and Render Customer List
 */
async function loadCustomers() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/customers`);
        
        if (response.status === 429) {
            console.warn('Rate limited by API');
            return; // Don't crash, just wait for next poll
        }

        if (!response.ok) {
            throw new Error(`API Error: ${response.status}`);
        }

        const text = await response.text();
        let customers;
        try {
            customers = JSON.parse(text);
        } catch (e) {
            console.error('Failed to parse customers JSON:', text);
            return;
        }
        
        if (!Array.isArray(customers) || customers.length === 0) {
            customerListEl.innerHTML = '<div class="loading">No conversations yet.</div>';
            return;
        }

        customerListEl.innerHTML = '';
        customers.forEach(customer => {
            const displayName = customer.customer_name || customer.phone;
            const initials = getInitials(customer.customer_name) || '?';
            const color = getAvatarStyle(customer.phone);
            
            // Handle last_message_at intelligently
            let lastTime = 'New';
            if (customer.last_message_at) {
                const date = new Date(customer.last_message_at);
                if (!isNaN(date.getTime())) {
                    lastTime = date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
                }
            }
            
            const item = document.createElement('div');
            item.className = `customer-item ${activeCustomer && activeCustomer.phone === customer.phone ? 'active' : ''}`;
            item.innerHTML = `
                <div class="avatar" style="background-color: ${color}">${initials}</div>
                <div class="customer-meta">
                    <h3>${displayName}</h3>
                    <p>${customer.phone}</p>
                </div>
                <div class="customer-time">${lastTime}</div>
            `;
            item.onclick = () => selectCustomer(customer);
            customerListEl.appendChild(item);
        });
    } catch (err) {
        console.error('Failed to load customers:', err);
        customerListEl.innerHTML = '<div class="error-message">Connection error. Retrying...</div>';
    }
}

/**
 * Select a customer and load their history
 */
async function selectCustomer(customer) {
    activeCustomer = customer;
    
    // UI Transitions
    chatWelcomeEl.classList.add('hidden');
    chatWindowEl.classList.remove('hidden');
    appContainerEl.classList.add('show-chat'); // Mobile toggle
    
    // Header Info
    const displayName = customer.customer_name || customer.phone;
    activeCustomerNameEl.innerText = displayName;
    activeCustomerPhoneEl.innerText = customer.phone;
    
    // Avatar logic
    activeAvatarEl.innerText = getInitials(customer.customer_name) || '?';
    activeAvatarEl.style.backgroundColor = getAvatarStyle(customer.phone);
    
    messageContainerEl.innerHTML = '<div class="loading">Loading messages...</div>';
    
    // Highlight active item in list
    document.querySelectorAll('.customer-item').forEach(el => {
        el.classList.remove('active');
        const phone = el.querySelector('.customer-meta p').innerText;
        if (phone === customer.phone) {
            el.classList.add('active');
        }
    });

    await loadChatHistory(customer.phone);
}

/**
 * Fetch and Render Chat History
 */
async function loadChatHistory(phone, isPolling = false) {
    try {
        const response = await fetch(`${API_BASE_URL}/api/history/${phone}`);
        
        if (response.status === 429) {
            console.warn('Rate limited while fetching history');
            return;
        }

        if (!response.ok) {
            throw new Error(`API Error: ${response.status}`);
        }

        const text = await response.text();
        let history;
        try {
            history = JSON.parse(text);
        } catch (e) {
            console.error('Failed to parse history JSON:', text);
            return;
        }
        
        // If polling and no new messages, don't re-render
        if (isPolling && JSON.stringify(history) === JSON.stringify(currentHistory)) {
            return;
        }

        currentHistory = history;
        renderMessages(history);
    } catch (err) {
        console.error('Failed to load history:', err);
        if (!isPolling) {
            messageContainerEl.innerHTML = '<div class="error-message">Failed to load chat history.</div>';
        }
    }
}

/**
 * Render messages in the chat window
 */
function renderMessages(history) {
    if (!Array.isArray(history)) {
        console.error('Invalid history data:', history);
        return;
    }

    messageContainerEl.innerHTML = '';
    history.forEach(msg => {
        const msgEl = document.createElement('div');
        
        // Normalize direction (handle inbound/outbound from WhatsApp API)
        let direction = msg.direction || 'incoming';
        if (direction === 'inbound') direction = 'incoming';
        if (direction === 'outbound') direction = 'outgoing';
        
        msgEl.className = `message message-${direction}`;
        
        let contentHtml = `<div class="message-content">${msg.body || '(Empty message)'}</div>`;
        
        // Handle Media (Image/Document)
        if (msg.mime_type) {
            const mediaUrl = `${API_BASE_URL}/api/media/${msg.chat_id}`;
            if (msg.mime_type.startsWith('image/')) {
                contentHtml = `
                    <img src="${mediaUrl}" class="message-media" onclick="window.open(this.src)" onerror="this.style.display='none'; this.nextElementSibling.style.display='block'">
                    <div class="message-content" style="display:none; font-style: italic; color: #8696a0;">Failed to load image</div>
                    ${msg.body ? `<div class="message-content">${msg.body}</div>` : ''}
                `;
            } else {
                const fileName = msg.message || 'Attachment';
                contentHtml = `
                    <a href="${mediaUrl}" target="_blank" class="message-doc">
                        <svg width="24" height="24" viewBox="0 0 24 24"><path fill="currentColor" d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"></path></svg>
                        <span>${fileName}</span>
                    </a>
                `;
            }
        }

        // Robust timestamp parsing (seconds vs milliseconds)
        let timeStr = '';
        try {
            let ts = msg.timestamp;
            // Meta API often returns seconds. JS needs ms.
            if (ts < 10000000000) ts = ts * 1000;
            const msgDate = new Date(ts);
            timeStr = isNaN(msgDate.getTime()) ? '' : msgDate.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        } catch (e) {
            console.warn('Invalid timestamp:', msg.timestamp);
        }

        msgEl.innerHTML = `
            ${contentHtml}
            <span class="message-time">${timeStr}</span>
        `;
        messageContainerEl.appendChild(msgEl);
    });
    
    // Scroll to bottom
    messageContainerEl.scrollTop = messageContainerEl.scrollHeight;
}

/**
 * Send a reply
 */
async function handleSend() {
    const text = messageInputEl.value.trim();
    if (!text || !activeCustomer) return;

    // Clear input
    messageInputEl.value = '';

    try {
        const response = await fetch(`${API_BASE_URL}/api/send`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                phone: activeCustomer.phone,
                message: text
            })
        });

        if (response.ok) {
            loadChatHistory(activeCustomer.phone);
        } else {
            alert('Failed to send message.');
        }
    } catch (err) {
        console.error('Send error:', err);
        alert('Error sending message.');
    }
}

/**
 * Mobile Navigation: Go back to list
 */
function backToList() {
    activeCustomer = null;
    appContainerEl.classList.remove('show-chat');
    // Keep it responsive for desktop
    if (window.innerWidth > 768) {
        chatWelcomeEl.classList.remove('hidden');
        chatWindowEl.classList.add('hidden');
    }
}

/**
 * Image Compression using Canvas
 */
async function compressImage(file) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const MAX_WIDTH = 1200;
                let width = img.width;
                let height = img.height;

                if (width > MAX_WIDTH) {
                    height *= MAX_WIDTH / width;
                    width = MAX_WIDTH;
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                // Compress to 70% quality JPEG
                resolve(canvas.toDataURL('image/jpeg', 0.7));
            };
        };
    });
}

/**
 * Handle File Upload
 */
async function handleFileUpload(e) {
    const file = e.target.files[0];
    if (!file || !activeCustomer) return;

    let mediaData = null;
    let mimeType = file.type;

    try {
        if (file.type.startsWith('image/')) {
            mediaData = await compressImage(file);
        } else {
            // Docs: read as base64
            mediaData = await new Promise((resolve) => {
                const reader = new FileReader();
                reader.readAsDataURL(file);
                reader.onload = () => resolve(reader.result);
            });
        }

        const response = await fetch(`${API_BASE_URL}/api/send`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                phone: activeCustomer.phone,
                mediaData: mediaData,
                mimeType: mimeType,
                message: file.name
            })
        });

        if (response.ok) {
            loadChatHistory(activeCustomer.phone);
        } else {
            alert('Failed to send file.');
        }
    } catch (err) {
        console.error('Upload error:', err);
        alert('Error sending file.');
    }
}

// Event Listeners
sendBtnEl.onclick = handleSend;
attachBtnEl.onclick = () => mediaInputEl.click();
cameraBtnEl.onclick = () => {
    mediaInputEl.setAttribute('capture', 'environment');
    mediaInputEl.click();
};
mediaInputEl.onchange = handleFileUpload;
mobileBackBtnEl.onclick = backToList;
messageInputEl.onkeydown = (e) => {
    if (e.key === 'Enter') handleSend();
};

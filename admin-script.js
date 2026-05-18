// ===========================================================
// ADMIN PANEL - EVENT MANAGEMENT SYSTEM
// ===========================================================

class AdminEventManager {
  constructor() {
    this.events = [];
    this.submissions = [];
    this.editingId = null;
    // Initialize as empty, will be loaded from API
    this.githubToken = '';
    this.githubRepo = '';
    this.githubBranch = 'main';
    this.init();
  }

  // Load GitHub configuration from API
  async loadGithubConfig() {
    try {
      const response = await fetch('/api/config');
      if (response.ok) {
        const config = await response.json();
        this.githubToken = config.githubToken || '';
        this.githubRepo = config.githubRepo || '';
        this.githubBranch = config.githubBranch || 'main';
      }
    } catch (error) {
      console.error('Error loading config:', error);
    }
  }

  // Initialize
  async init() {
    await this.loadGithubConfig();
    await this.loadEvents();
    await this.loadSubmissions();
    await this.loadSellerConfig();
    this.setupEventListeners();
    this.setupTabListeners();
    this.setupSellerFormListener();
    this.renderEvents();
    this.renderSubmissions();
    this.displayAuthStatus();
    
    // Auto-refresh submissions every 10 seconds to show customer submissions
    setInterval(async () => {
      await this.loadSubmissions();
      this.renderSubmissions();
    }, 10000);
  }

  // Display GitHub authentication status
  displayAuthStatus() {
    const status = this.githubToken ? '✅ GitHub authenticated (via environment)' : '⚠️ GitHub not configured (set environment variables on Vercel)';
    console.log(status);
  }

  // Load Events from localStorage or events.json
  async loadEvents() {
    try {
      // First, try to load from localStorage (most recent)
      const stored = localStorage.getItem('events');
      if (stored) {
        this.events = JSON.parse(stored);
      } else {
        // Fallback to events.json
        const response = await fetch('events.json');
        if (response.ok) {
          const data = await response.json();
          this.events = data.events;
          this.saveEventsLocally();
        }
      }
    } catch (error) {
      console.error('Error loading events:', error);
      this.showStatus('form-status', 'Error loading events', 'error');
    }
  }

  // Save Events Locally (localStorage)
  saveEventsLocally() {
    localStorage.setItem('events', JSON.stringify(this.events));
  }

  // Setup Event Listeners
  setupEventListeners() {
    const form = document.getElementById('event-form');
    const exportBtn = document.getElementById('export-btn');
    const refreshBtn = document.getElementById('refresh-btn');
    const cancelEditBtn = document.getElementById('cancel-edit');

    form.addEventListener('submit', (e) => this.handleFormSubmit(e));
    exportBtn.addEventListener('click', () => this.exportEvents());
    refreshBtn.addEventListener('click', () => this.refreshPage());
    cancelEditBtn.addEventListener('click', () => this.cancelEdit());
  }

  // Setup Tab Listeners
  setupTabListeners() {
    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    tabButtons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const tabId = e.target.dataset.tab;
        
        // Remove active from all
        tabButtons.forEach(b => b.classList.remove('active'));
        tabContents.forEach(c => c.classList.remove('active'));
        
        // Add active to clicked
        e.target.classList.add('active');
        document.getElementById(tabId).classList.add('active');
      });
    });

    // Submissions tab buttons
    const exportSubmissionsBtn = document.getElementById('export-submissions-btn');
    const clearSubmissionsBtn = document.getElementById('clear-submissions-btn');
    const submissionModalClose = document.getElementById('submission-modal-close');

    if (exportSubmissionsBtn) {
      exportSubmissionsBtn.addEventListener('click', () => this.exportSubmissions());
    }
    if (clearSubmissionsBtn) {
      clearSubmissionsBtn.addEventListener('click', () => this.clearAllSubmissions());
    }
    if (submissionModalClose) {
      submissionModalClose.addEventListener('click', () => this.closeSubmissionModal());
    }

    // Close modal on background click
    const modal = document.getElementById('submission-modal');
    if (modal) {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          this.closeSubmissionModal();
        }
      });
    }
  }

  // Load Submissions
  async loadSubmissions() {
    try {
      // Disabled: Direct GitHub URL fetching from My-Ticketmaster repos
      // This prevents unauthorized access to other projects' data
      // Instead, use API endpoints with proper authentication
      // 
      // DISABLED:
      // - fetch('https://raw.githubusercontent.com/Cryptovaultiq/My-Ticketmaster-admin/main/submissions.json')
      // - fetch('https://raw.githubusercontent.com/Cryptovaultiq/My-Own-ticketmaster-Customer/main/submissions.json')
      //
      // Load from localStorage as fallback
      const stored = localStorage.getItem('submissions');
      if (stored) {
        try {
          const data = JSON.parse(stored);
          this.submissions = data.submissions || [];
        } catch (e) {
          this.submissions = [];
        }
      } else {
        this.submissions = [];
      }
    } catch (error) {
      console.error('Error loading submissions:', error);
      this.submissions = [];
    }
  }

  // Save Submissions Locally
  saveSubmissionsLocally() {
    localStorage.setItem('submissions', JSON.stringify(this.submissions));
  }

  // Add New Submission
  async addSubmission(submissionData) {
    try {
      const newSubmission = {
        id: Date.now(),
        ...submissionData,
        timestamp: new Date().toISOString(),
        date: new Date().toLocaleDateString() + ' ' + new Date().toLocaleTimeString()
      };

      this.submissions.unshift(newSubmission); // Add to top
      this.saveSubmissionsLocally();
      
      // Auto-sync to GitHub if configured
      if (this.githubToken && this.githubRepo) {
        await this.syncSubmissionsToGithub();
      }

      this.renderSubmissions();
      console.log('✅ Submission saved and synced');
    } catch (error) {
      console.error('Error adding submission:', error);
    }
  }

  // Render Submissions
  renderSubmissions() {
    const tbody = document.getElementById('submissions-tbody');
    const noMessage = document.getElementById('no-submissions-message');
    const table = document.getElementById('submissions-table');

    if (!tbody) return;

    tbody.innerHTML = '';

    if (this.submissions.length === 0) {
      table.style.display = 'none';
      noMessage.style.display = 'block';
      return;
    }

    table.style.display = 'table';
    noMessage.style.display = 'none';

    this.submissions.forEach((submission, index) => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${index + 1}</td>
        <td>${submission.email}</td>
        <td>${submission.eventTitle}</td>
        <td>${submission.quantity}</td>
        <td>$${parseFloat(submission.total).toFixed(2)}</td>
        <td>${submission.date}</td>
        <td><span class="submission-detail" onclick="manager.viewSubmission(${submission.id})">View</span></td>
      `;
      tbody.appendChild(row);
    });
  }

  // View Submission Details
  viewSubmission(id) {
    const submission = this.submissions.find(s => s.id === id);
    if (!submission) return;

    const detailsContent = document.getElementById('submission-details-content');
    let html = '';

    for (const [key, value] of Object.entries(submission)) {
      if (key !== 'id') {
        const label = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
        html += `
          <div class="submission-field">
            <div class="submission-label">${label}:</div>
            <div class="submission-value">${value}</div>
          </div>
        `;
      }
    }

    detailsContent.innerHTML = html;
    document.getElementById('submission-modal').classList.add('active');
  }

  // Close Submission Modal
  closeSubmissionModal() {
    document.getElementById('submission-modal').classList.remove('active');
  }

  // Export Submissions
  exportSubmissions() {
    const dataStr = JSON.stringify({ submissions: this.submissions }, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `submissions-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
    this.showStatus('submissions-message', 'Submissions exported successfully!', 'success');
  }

  // Clear All Submissions
  clearAllSubmissions() {
    if (confirm('Are you sure you want to delete ALL submissions? This cannot be undone!')) {
      this.submissions = [];
      this.saveSubmissionsLocally();
      this.renderSubmissions();
      this.showStatus('submissions-message', 'All submissions cleared!', 'success');
      
      if (this.githubToken && this.githubRepo) {
        this.syncSubmissionsToGithub();
      }
    }
  }

  // Sync Submissions to GitHub
  async syncSubmissionsToGithub() {
    if (!this.githubToken || !this.githubRepo) {
      return;
    }

    try {
      const [owner, repo] = this.githubRepo.split('/');
      const filePath = 'submissions.json';
      const fileContent = JSON.stringify({ submissions: this.submissions }, null, 2);
      const base64Content = btoa(unescape(encodeURIComponent(fileContent)));

      let sha = null;
      try {
        const getResponse = await fetch(
          `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`,
          {
            headers: {
              'Authorization': `Bearer ${this.githubToken}`,
              'Accept': 'application/vnd.github.v3+json'
            }
          }
        );
        if (getResponse.ok) {
          const fileData = await getResponse.json();
          sha = fileData.sha;
        }
      } catch (e) {
        // File doesn't exist yet
      }

      const uploadResponse = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${this.githubToken}`,
            'Accept': 'application/vnd.github.v3+json',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            message: `Update submissions - ${new Date().toISOString()}`,
            content: base64Content,
            branch: this.githubBranch,
            ...(sha && { sha })
          })
        }
      );

      if (uploadResponse.ok) {
        console.log('✅ Submissions synced to GitHub automatically');
      }
    } catch (error) {
      console.error('Submissions GitHub sync error:', error);
    }
  }

  // Handle Image File Upload
  async handleImageUpload(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const base64Data = e.target.result.split(',')[1]; // Remove data:image/...;base64, prefix
          const fileName = `${Date.now()}_${file.name}`;
          
          // Upload to GitHub if configured
          if (this.githubToken && this.githubRepo) {
            const uploadPath = `assets/${fileName}`;
            const uploaded = await this.uploadFileToGithub(uploadPath, base64Data);
            if (uploaded) {
              // Return full GitHub raw URL
              const [owner, repo] = this.githubRepo.split('/');
              const imageUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${this.githubBranch}/${uploadPath}`;
              resolve(imageUrl);
            } else {
              // Fallback to just storing filename
              resolve(fileName);
            }
          } else {
            // No GitHub config, just use filename
            resolve(fileName);
          }
        } catch (error) {
          console.error('Image upload error:', error);
          reject(error);
        }
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  // Upload file to GitHub
  async uploadFileToGithub(filePath, base64Content) {
    if (!this.githubToken || !this.githubRepo) {
      console.warn('GitHub not configured');
      return false;
    }

    try {
      const [owner, repo] = this.githubRepo.split('/');
      
      // Get existing file SHA if it exists
      let sha = null;
      try {
        const getResponse = await fetch(
          `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`,
          {
            headers: {
              'Authorization': `Bearer ${this.githubToken}`,
              'Accept': 'application/vnd.github.v3+json'
            }
          }
        );
        if (getResponse.ok) {
          const fileData = await getResponse.json();
          sha = fileData.sha;
        }
      } catch (e) {
        // File doesn't exist yet
      }

      // Upload or update file
      const uploadResponse = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${this.githubToken}`,
            'Accept': 'application/vnd.github.v3+json',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            message: `Upload image: ${filePath}`,
            content: base64Content,
            branch: this.githubBranch,
            ...(sha && { sha })
          })
        }
      );

      return uploadResponse.ok;
    } catch (error) {
      console.error('GitHub upload error:', error);
      return false;
    }
  }

  // Handle Form Submit
  async handleFormSubmit(e) {
    e.preventDefault();

    const id = document.getElementById('event-id').value;
    const imageFile = document.getElementById('event-image').files[0];

    // Validate image file
    if (!imageFile && !this.editingId) {
      this.showStatus('form-status', 'Please select an image file!', 'error');
      return;
    }

    try {
      let imageUrl = '';

      // Handle image upload
      if (imageFile) {
        this.showStatus('form-status', 'Uploading image...', 'info');
        imageUrl = await this.handleImageUpload(imageFile);
      } else if (this.editingId) {
        // Keep existing image when editing without changing image
        const existing = this.events.find(e => e.id === parseInt(this.editingId));
        imageUrl = existing?.imageUrl || '';
      }

      const eventData = {
        title: document.getElementById('event-title').value.trim(),
        location: document.getElementById('event-location').value.trim(),
        dateTime: document.getElementById('event-datetime').value.trim(),
        price: parseFloat(document.getElementById('event-price').value),
        ticketsAvailable: parseInt(document.getElementById('event-tickets').value),
        imageUrl: imageUrl,
        imageAlt: document.getElementById('event-alt').value.trim(),
        category: document.getElementById('event-category').value,
      };

      // Validation
      if (!eventData.title || !eventData.location || !eventData.dateTime || 
          !eventData.imageUrl || !eventData.category) {
        this.showStatus('form-status', 'Please fill all required fields!', 'error');
        return;
      }

      if (this.editingId) {
        // Update existing event
        const eventIndex = this.events.findIndex(e => e.id === parseInt(this.editingId));
        if (eventIndex !== -1) {
          this.events[eventIndex] = { id: parseInt(this.editingId), ...eventData };
          this.showStatus('form-status', 'Event updated successfully!', 'success');
        }
      } else {
        // Add new event
        const newId = this.events.length > 0 ? Math.max(...this.events.map(e => e.id)) + 1 : 1;
        this.events.push({ id: newId, ...eventData });
        this.showStatus('form-status', 'Event added successfully!', 'success');
      }

      this.saveEventsLocally();
      
      // Auto-sync to GitHub if configured
      if (this.githubToken && this.githubRepo) {
        await this.syncToGithub();
      }

      this.renderEvents();
      this.resetForm();
      this.editingId = null;
    } catch (error) {
      console.error('Form submission error:', error);
      this.showStatus('form-status', `Error: ${error.message}`, 'error');
    }
  }

  // Edit Event
  editEvent(id) {
    const event = this.events.find(e => e.id === id);
    if (!event) return;

    this.editingId = id;
    document.getElementById('event-id').value = event.id;
    document.getElementById('event-title').value = event.title;
    document.getElementById('event-location').value = event.location;
    document.getElementById('event-datetime').value = event.dateTime;
    document.getElementById('event-price').value = event.price;
    document.getElementById('event-tickets').value = event.ticketsAvailable;
    // Don't require image file when editing
    document.getElementById('event-image').required = false;
    document.getElementById('event-alt').value = event.imageAlt;
    document.getElementById('event-category').value = event.category;

    // Scroll to form
    document.querySelector('.form-section').scrollIntoView({ behavior: 'smooth' });
    document.getElementById('event-title').focus();
  }

  // Cancel Edit
  cancelEdit() {
    this.editingId = null;
    this.resetForm();
    this.showStatus('form-status', 'Edit cancelled', 'info');
  }

  // Delete Event
  deleteEvent(id) {
    if (confirm('Are you sure you want to delete this event?')) {
      this.events = this.events.filter(e => e.id !== id);
      this.saveEventsLocally();
      
      // Auto-sync to GitHub if configured
      if (this.githubToken && this.githubRepo) {
        this.syncToGithub();
      }

      this.renderEvents();
      this.showStatus('form-status', 'Event deleted successfully!', 'success');
    }
  }

  // Render Events
  renderEvents() {
    const container = document.getElementById('events-container');
    container.innerHTML = '';

    if (this.events.length === 0) {
      container.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: #888;">No events yet. Create one above!</p>';
      return;
    }

    this.events.forEach(event => {
      const card = document.createElement('div');
      card.className = 'event-card';
      card.innerHTML = `
        <div class="event-id">ID: ${event.id}</div>
        <h3>${event.title}</h3>
        <p><span class="label">📍 Location:</span> ${event.location}</p>
        <p><span class="label">📅 Date/Time:</span> ${event.dateTime}</p>
        <p><span class="label">💰 Price:</span> $${event.price.toFixed(2)}</p>
        <p><span class="label">🎫 Tickets:</span> ${event.ticketsAvailable} available</p>
        <p><span class="label">🎬 Category:</span> ${event.category}</p>
        <p><span class="label">🖼️ Image:</span> ${event.imageUrl}</p>
        <div class="event-card-actions">
          <button class="btn btn-primary btn-small" onclick="manager.editEvent(${event.id})">Edit</button>
          <button class="btn btn-secondary btn-small" onclick="manager.deleteEvent(${event.id})">Delete</button>
        </div>
      `;
      container.appendChild(card);
    });
  }

  // Export Events
  exportEvents() {
    const dataStr = JSON.stringify({ events: this.events }, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `events-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
    this.showStatus('form-status', 'Events exported successfully!', 'success');
  }

  // GitHub: Sync Events to GitHub
  async syncToGithub() {
    if (!this.githubToken || !this.githubRepo) {
      console.warn('GitHub not configured');
      return;
    }

    try {
      const [owner, repo] = this.githubRepo.split('/');
      const filePath = 'events.json';
      const fileContent = JSON.stringify({ events: this.events }, null, 2);
      const base64Content = btoa(unescape(encodeURIComponent(fileContent)));

      // Get the file SHA if it exists
      let sha = null;
      try {
        const getResponse = await fetch(
          `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`,
          {
            headers: {
              'Authorization': `Bearer ${this.githubToken}`,
              'Accept': 'application/vnd.github.v3+json'
            }
          }
        );
        if (getResponse.ok) {
          const fileData = await getResponse.json();
          sha = fileData.sha;
        }
      } catch (e) {
        // File doesn't exist yet, that's okay
      }

      // Upload or update file
      const uploadResponse = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${this.githubToken}`,
            'Accept': 'application/vnd.github.v3+json',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            message: `Update events - ${new Date().toISOString()}`,
            content: base64Content,
            branch: this.githubBranch,
            ...(sha && { sha })
          })
        }
      );

      if (uploadResponse.ok) {
        console.log('✅ Events synced to GitHub automatically');
      } else {
        const errorData = await uploadResponse.json();
        console.error('GitHub sync failed:', errorData.message);
      }
    } catch (error) {
      console.error('GitHub sync error:', error);
    }
  }

  // Load Seller Configuration
  async loadSellerConfig() {
    try {
      // Disabled: Direct GitHub URL fetching from My-Ticketmaster repos
      // This prevents unauthorized access to other projects' configuration
      // DISABLED: fetch('https://raw.githubusercontent.com/Cryptovaultiq/My-Ticketmaster-admin/main/seller-config.json')
      //
      // Set default seller link or use local configuration
      const sellerLinkInput = document.getElementById('seller-link');
      if (sellerLinkInput) {
        // Use default value from seller-config.json or set a placeholder
        const defaultLink = 'https://example.com'; // Replace with your Rahman repo's seller link if needed
        sellerLinkInput.value = defaultLink;
      }
    } catch (error) {
      console.error('Error loading seller config:', error);
    }
  }

  // Setup Seller Form Listener
  setupSellerFormListener() {
    const sellerForm = document.getElementById('seller-form');
    if (sellerForm) {
      sellerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        await this.handleSellerFormSubmit();
      });
    }
  }

  // Handle Seller Form Submit
  async handleSellerFormSubmit() {
    const sellerLink = document.getElementById('seller-link').value.trim();
    const statusSpan = document.getElementById('seller-save-status');

    if (!sellerLink) {
      alert('Please enter a valid URL');
      return;
    }

    try {
      const sellerConfig = { sellerLink };
      await this.syncSellerConfigToGithub(sellerConfig);
      
      if (statusSpan) {
        statusSpan.style.display = 'inline';
        setTimeout(() => {
          statusSpan.style.display = 'none';
        }, 3000);
      }

      alert('✅ Seller link updated and saved to GitHub!');
    } catch (error) {
      console.error('Error saving seller config:', error);
      alert('Error saving seller link. Please try again.');
    }
  }

  // Sync Seller Config to GitHub
  async syncSellerConfigToGithub(sellerConfig) {
    if (!this.githubToken || !this.githubRepo) {
      alert('GitHub configuration not available');
      return;
    }

    try {
      const [owner, repo] = this.githubRepo.split('/');
      const filePath = 'seller-config.json';
      const fileContent = JSON.stringify(sellerConfig, null, 2);
      const base64Content = btoa(unescape(encodeURIComponent(fileContent)));

      // Get the file SHA if it exists
      let sha = null;
      try {
        const getResponse = await fetch(
          `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`,
          {
            headers: {
              'Authorization': `Bearer ${this.githubToken}`,
              'Accept': 'application/vnd.github.v3+json'
            }
          }
        );
        if (getResponse.ok) {
          const fileData = await getResponse.json();
          sha = fileData.sha;
        }
      } catch (e) {
        // File doesn't exist yet
      }

      // Upload or update file
      const uploadResponse = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${this.githubToken}`,
            'Accept': 'application/vnd.github.v3+json',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            message: `Update seller configuration - ${new Date().toISOString()}`,
            content: base64Content,
            branch: this.githubBranch,
            ...(sha && { sha })
          })
        }
      );

      if (!uploadResponse.ok) {
        throw new Error('Failed to sync to GitHub');
      }

      console.log('✅ Seller config synced to GitHub');
    } catch (error) {
      console.error('GitHub sync error:', error);
      throw error;
    }
  }

  // Reset Form
  resetForm() {
    document.getElementById('event-form').reset();
    document.getElementById('event-id').value = '';
    document.getElementById('event-image').required = true;
    this.editingId = null;
  }

  // Refresh Page
  refreshPage() {
    location.reload();
  }

  // Show Status Message
  showStatus(elementId, message, type) {
    const element = document.getElementById(elementId);
    if (!element) return;
    element.textContent = message;
    element.className = `status-message ${type}`;
    setTimeout(() => {
      element.className = 'status-message';
    }, 4000);
  }
}

// Initialize Manager when page loads
let manager;
document.addEventListener('DOMContentLoaded', () => {
  manager = new AdminEventManager();
});

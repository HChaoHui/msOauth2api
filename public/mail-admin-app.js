(function () {
  const mailImportUtils = window.MailImportUtils || {};
  const ACCOUNT_STORAGE_KEY = 'mailAccounts';
  const API_PASSWORD_KEY = 'password';

  let accounts = [];
  let selectedItems = [];
  let mailData = [];
  let currentPage = 1;
  let itemsPerPage = 5;
  let currentMailPage = 1;
  const mailItemsPerPage = 10;

  function getApiPassword() {
    return localStorage.getItem(API_PASSWORD_KEY) || '';
  }

  function setStoredAccounts(nextAccounts) {
    accounts = [...nextAccounts].sort((left, right) => {
      return String(right.updatedAt || '').localeCompare(String(left.updatedAt || ''));
    });
    localStorage.setItem(ACCOUNT_STORAGE_KEY, JSON.stringify(accounts));
  }

  function loadStoredAccounts() {
    try {
      const raw = localStorage.getItem(ACCOUNT_STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      accounts = Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      accounts = [];
    }
  }

  function createAccountId() {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') {
      return `local_${window.crypto.randomUUID().replace(/-/g, '')}`;
    }

    return `local_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function showLoading() {
    document.getElementById('loading-overlay').style.display = 'flex';
  }

  function hideLoading() {
    document.getElementById('loading-overlay').style.display = 'none';
  }

  function showModal(title, message) {
    document.getElementById('modal-title').textContent = title;
    document.getElementById('modal-message').innerHTML = message;
    document.getElementById('modal').style.display = 'flex';
  }

  function closeModal() {
    document.getElementById('modal').style.display = 'none';
  }

  function closeMailModal() {
    document.getElementById('mail-modal').style.display = 'none';
  }

  async function apiPost(url, payload) {
    const password = getApiPassword();
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(password ? { ...payload, password } : payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      const error = new Error(errorText || 'Request failed');
      error.status = response.status;
      throw error;
    }

    return response.json();
  }

  function showSection(targetId) {
    const links = document.querySelectorAll('.sidebar a');
    const contentSections = document.querySelectorAll('.content-section');

    links.forEach((link) => {
      if (link.dataset.target === targetId) {
        link.classList.add('active');
      } else if (link.dataset.external !== 'true') {
        link.classList.remove('active');
      }
    });

    contentSections.forEach((section) => {
      section.classList.toggle('active', section.id === targetId);
    });
  }

  function updateDashboard() {
    document.getElementById('account-count').textContent = String(accounts.length);
  }

  function ensureVisitorModeNote() {
    const delimiterSection = document.querySelector('.delimiter-input');
    if (!delimiterSection || document.getElementById('visitor-mode-note')) {
      return;
    }

    const note = document.createElement('p');
    note.id = 'visitor-mode-note';
    note.className = 'paste-help';
    note.textContent = '账号只保存在当前浏览器本地，不会上传到服务器账号池。清理浏览器数据后，本地账号也会一起清除。';
    delimiterSection.insertAdjacentElement('afterend', note);
  }

  function updateUiCopy() {
    const passwordInput = document.getElementById('password');
    if (passwordInput) {
      passwordInput.placeholder = '可选：接口访问密码，仅在你的浏览器本地保存';
    }
  }

  function toggleNoData() {
    document.getElementById('no-data').style.display = accounts.length ? 'none' : 'block';
  }

  function truncateToken(token) {
    return token || '';
  }

  function renderTable() {
    const tableBody = document.querySelector('#email-table tbody');
    tableBody.innerHTML = '';

    const start = (currentPage - 1) * itemsPerPage;
    const pageData = accounts.slice(start, start + itemsPerPage);

    pageData.forEach((account) => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td><input type="checkbox" data-account-id="${escapeHtml(account.id)}"></td>
        <td>${escapeHtml(account.email)}</td>
        <td>${escapeHtml(account.password)}</td>
        <td>${escapeHtml(account.clientId)}</td>
        <td class="refresh-token" title="${escapeHtml(account.refreshToken)}">${escapeHtml(truncateToken(account.refreshToken))}</td>
        <td>
          <div class="table-actions">
            <button class="view" onclick="viewInbox('${escapeHtml(account.id)}')">收件箱</button>
            <button class="view" onclick="viewJunk('${escapeHtml(account.id)}')">垃圾箱</button>
            <button class="delete" onclick="deleteEmail('${escapeHtml(account.id)}')">删除</button>
          </div>
        </td>
      `;
      tableBody.appendChild(row);
    });

    toggleNoData();
    renderPagination();
  }

  function renderPagination() {
    const pagination = document.getElementById('pagination');
    pagination.innerHTML = '';

    const totalPages = Math.max(1, Math.ceil(accounts.length / itemsPerPage));
    currentPage = Math.min(currentPage, totalPages);

    for (let page = 1; page <= totalPages; page += 1) {
      const button = document.createElement('button');
      button.textContent = String(page);
      if (page === currentPage) {
        button.classList.add('active');
      }
      button.onclick = () => changePage(page);
      pagination.appendChild(button);
    }
  }

  function renderMailTable() {
    const tableBody = document.querySelector('#mail-table tbody');
    tableBody.innerHTML = '';

    const start = (currentMailPage - 1) * mailItemsPerPage;
    const pageData = mailData.slice(start, start + mailItemsPerPage);

    pageData.forEach((message, index) => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${escapeHtml(message.send)}</td>
        <td>${escapeHtml(message.subject)}</td>
        <td>${escapeHtml(message.date)}</td>
        <td><button onclick="viewMail(${start + index})">查看</button></td>
      `;
      tableBody.appendChild(row);
    });

    document.getElementById('no-data-mail').style.display = mailData.length ? 'none' : 'block';
    renderMailPagination();
  }

  function renderMailPagination() {
    const pagination = document.getElementById('pagination-mail');
    pagination.innerHTML = '';

    const totalPages = Math.max(1, Math.ceil(mailData.length / mailItemsPerPage));
    currentMailPage = Math.min(currentMailPage, totalPages);

    for (let page = 1; page <= totalPages; page += 1) {
      const button = document.createElement('button');
      button.textContent = String(page);
      if (page === currentMailPage) {
        button.classList.add('active');
      }
      button.onclick = () => changeMailPage(page);
      pagination.appendChild(button);
    }
  }

  function updateSelectedItems() {
    selectedItems = Array.from(
      document.querySelectorAll('#email-table tbody input[type="checkbox"]:checked')
    ).map((checkbox) => checkbox.dataset.accountId);
  }

  function attachSidebarNavigation() {
    document.querySelectorAll('.sidebar a').forEach((link) => {
      link.addEventListener('click', (event) => {
        if (link.dataset.external === 'true') {
          return;
        }

        event.preventDefault();
        showSection(link.dataset.target);
      });
    });
  }

  function attachSelectionHandlers() {
    document.getElementById('select-all').addEventListener('change', function () {
      document
        .querySelectorAll('#email-table tbody input[type="checkbox"]')
        .forEach((checkbox) => {
          checkbox.checked = this.checked;
        });
      updateSelectedItems();
    });

    document.querySelector('#email-table tbody').addEventListener('change', (event) => {
      if (event.target.type === 'checkbox') {
        updateSelectedItems();
      }
    });
  }

  function attachUploadHandlers() {
    const uploadBox = document.getElementById('upload-box');
    const fileInput = document.getElementById('file-input');
    const fileInfo = document.getElementById('file-info');

    uploadBox.addEventListener('click', () => {
      fileInput.click();
    });

    fileInput.addEventListener('change', () => {
      if (fileInput.files.length > 0) {
        fileInfo.textContent = `已选择文件：${fileInput.files[0].name}`;
      }
    });

    uploadBox.addEventListener('dragover', (event) => {
      event.preventDefault();
      uploadBox.classList.add('dragover');
    });

    uploadBox.addEventListener('dragleave', () => {
      uploadBox.classList.remove('dragover');
    });

    uploadBox.addEventListener('drop', (event) => {
      event.preventDefault();
      uploadBox.classList.remove('dragover');

      const files = event.dataTransfer.files;
      if (files.length > 0) {
        fileInput.files = files;
        fileInfo.textContent = `已选择文件：${files[0].name}`;
      }
    });
  }

  function loadData() {
    loadStoredAccounts();
    selectedItems = [];
    currentPage = 1;
    const selectAll = document.getElementById('select-all');
    if (selectAll) {
      selectAll.checked = false;
    }
    updateDashboard();
    renderTable();
  }

  function getImportedRows(content, delimiter) {
    if (typeof mailImportUtils.parseEmailText !== 'function') {
      showModal('错误', '导入组件加载失败，请刷新页面后重试。');
      return [];
    }

    return mailImportUtils.parseEmailText(content, delimiter);
  }

  function mergeImportedRows(rows) {
    const nextAccounts = [...accounts];
    let importedCount = 0;

    rows.forEach((row, index) => {
      if (!row?.email || !row?.password || !row?.clientId || !row?.refreshToken) {
        return;
      }

      const normalized = {
        email: String(row.email).trim(),
        password: String(row.password).trim(),
        clientId: String(row.clientId).trim(),
        refreshToken: String(row.refreshToken).trim(),
      };

      const existingIndex = nextAccounts.findIndex((account) => account.email === normalized.email);
      const timestamp = new Date(Date.now() + index).toISOString();

      if (existingIndex >= 0) {
        nextAccounts[existingIndex] = {
          ...nextAccounts[existingIndex],
          ...normalized,
          updatedAt: timestamp,
        };
      } else {
        nextAccounts.push({
          id: createAccountId(),
          ...normalized,
          createdAt: timestamp,
          updatedAt: timestamp,
        });
      }

      importedCount += 1;
    });

    setStoredAccounts(nextAccounts);
    return importedCount;
  }

  async function saveImportedRows(rows) {
    if (rows.length === 0) {
      showModal('错误', '未识别到有效邮箱数据，请检查分隔符和导入格式。');
      return false;
    }

    showLoading();
    try {
      const importedCount = mergeImportedRows(rows);
      currentPage = 1;
      updateDashboard();
      renderTable();
      showModal('导入成功', `成功导入 ${importedCount} 条邮箱数据，数据仅保存在当前浏览器本地。`);
      return true;
    } finally {
      hideLoading();
    }
  }

  function importEmails() {
    const delimiter = document.getElementById('delimiter').value.trim();
    const fileInput = document.getElementById('file-input');

    if (!delimiter) {
      showModal('错误', '请先确认分隔符。');
      return;
    }

    if (fileInput.files.length === 0) {
      showModal('错误', '请先选择要导入的 TXT 文件。');
      return;
    }

    const reader = new FileReader();
    reader.onload = async (event) => {
      const rows = getImportedRows(event.target.result, delimiter);
      await saveImportedRows(rows);
    };
    reader.readAsText(fileInput.files[0]);
  }

  async function importEmailsFromText() {
    const delimiter = document.getElementById('delimiter').value.trim();
    const pasteInput = document.getElementById('paste-input');
    const content = pasteInput.value.trim();

    if (!delimiter) {
      showModal('错误', '请先确认分隔符。');
      return;
    }

    if (!content) {
      showModal('错误', '请先粘贴要导入的邮箱数据。');
      return;
    }

    const rows = getImportedRows(content, delimiter);
    const success = await saveImportedRows(rows);
    if (success) {
      pasteInput.value = '';
    }
  }

  function deleteEmail(accountId) {
    if (!window.confirm('确定要删除这个本地账号吗？')) {
      return;
    }

    setStoredAccounts(accounts.filter((account) => account.id !== accountId));
    selectedItems = selectedItems.filter((item) => item !== accountId);
    updateDashboard();
    renderTable();
    showModal('删除成功', '本地账号已删除。');
  }

  function batchDelete() {
    if (selectedItems.length === 0) {
      showModal('提示', '请先勾选要删除的账号。');
      return;
    }

    if (!window.confirm(`确定要批量删除本地保存的 ${selectedItems.length} 个账号吗？`)) {
      return;
    }

    const idSet = new Set(selectedItems);
    setStoredAccounts(accounts.filter((account) => !idSet.has(account.id)));
    selectedItems = [];
    document.getElementById('select-all').checked = false;
    updateDashboard();
    renderTable();
    showModal('删除成功', '已从当前浏览器删除所选账号。');
  }

  function getAccountById(accountId) {
    return accounts.find((account) => account.id === accountId) || null;
  }

  async function loadMailList(accountId, mailbox) {
    const account = getAccountById(accountId);

    if (!account) {
      showModal('错误', '未找到对应的本地账号记录。');
      return;
    }

    showLoading();
    try {
      const result = await apiPost('/api/mail-all', {
        refresh_token: account.refreshToken,
        client_id: account.clientId,
        email: account.email,
        mailbox,
      });

      mailData = Array.isArray(result) ? result : [];
      currentMailPage = 1;
      document.getElementById('mail-list-title').textContent =
        mailbox === 'Junk' ? '垃圾箱邮件列表' : '收件箱邮件列表';
      document.getElementById('mail-list-subtitle').textContent = account.email;
      renderMailTable();
      showSection('mail-list');
    } catch (error) {
      if (error.status === 401) {
        showModal('提示', '接口启用了访问密码，请先输入正确密码后再查邮件。');
      } else {
        showModal('错误', '无法加载邮件列表，请检查账号信息后重试。');
      }
    } finally {
      hideLoading();
    }
  }

  function viewInbox(accountId) {
    loadMailList(accountId, 'INBOX');
  }

  function viewJunk(accountId) {
    loadMailList(accountId, 'Junk');
  }

  function viewMail(index) {
    const item = mailData[index];
    if (!item) {
      return;
    }

    document.getElementById('mail-modal-title').textContent = item.subject || '无主题';
    document.getElementById('mail-modal-sender').textContent = `发件人: ${item.send || ''}`;
    document.getElementById('mail-modal-subject').textContent = `主题: ${item.subject || ''}`;
    document.getElementById('mail-modal-date').textContent = `日期: ${item.date || ''}`;
    document.getElementById('mail-modal-content').innerHTML = item.html || escapeHtml(item.text || '');
    document.getElementById('mail-modal').style.display = 'flex';
  }

  function changePage(page) {
    currentPage = page;
    renderTable();
  }

  function changeItemsPerPage(value) {
    itemsPerPage = parseInt(value, 10) || 5;
    currentPage = 1;
    renderTable();
  }

  function changeMailPage(page) {
    currentMailPage = page;
    renderMailTable();
  }

  function setPassword() {
    const password = document.getElementById('password').value.trim();
    localStorage.setItem(API_PASSWORD_KEY, password);
  }

  function initializePassword() {
    const password = getApiPassword();
    if (password) {
      document.getElementById('password').value = password;
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    initializePassword();
    ensureVisitorModeNote();
    updateUiCopy();
    attachSidebarNavigation();
    attachSelectionHandlers();
    attachUploadHandlers();
    loadData();
  });

  window.importEmails = importEmails;
  window.importEmailsFromText = importEmailsFromText;
  window.changePage = changePage;
  window.changeItemsPerPage = changeItemsPerPage;
  window.changeMailPage = changeMailPage;
  window.viewInbox = viewInbox;
  window.viewJunk = viewJunk;
  window.viewMail = viewMail;
  window.deleteEmail = deleteEmail;
  window.batchDelete = batchDelete;
  window.closeModal = closeModal;
  window.closeMailModal = closeMailModal;
  window.setPassword = setPassword;
})();

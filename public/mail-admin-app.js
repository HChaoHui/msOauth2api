(function () {
  const mailImportUtils = window.MailImportUtils || {};

  let accounts = [];
  let selectedItems = [];
  let mailData = [];
  let currentPage = 1;
  let itemsPerPage = 5;
  let currentMailPage = 1;
  const mailItemsPerPage = 10;

  function getAdminPassword() {
    return localStorage.getItem('password') || '';
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

  function getRequestParams(req) {
    return req || {};
  }

  async function apiGet(url, extraParams) {
    const params = new URLSearchParams({
      ...extraParams,
      password: getAdminPassword(),
    });
    const response = await fetch(`${url}?${params.toString()}`);

    if (!response.ok) {
      const errorText = await response.text();
      const error = new Error(errorText || 'Request failed');
      error.status = response.status;
      throw error;
    }

    return response.json();
  }

  async function apiPost(url, payload) {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...payload,
        password: getAdminPassword(),
      }),
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

  function toggleNoData() {
    document.getElementById('no-data').style.display = accounts.length ? 'none' : 'block';
  }

  function truncateToken(token) {
    return token || '';
  }

  function getShareUrl(account) {
    return `${window.location.origin}/boobar?share=${encodeURIComponent(account.shareToken)}`;
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
            <button class="secondary" onclick="copyShareLink('${escapeHtml(account.id)}')">分享链接</button>
            <button class="secondary" onclick="resetShareLink('${escapeHtml(account.id)}')">重置链接</button>
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

  async function loadData() {
    showLoading();
    try {
      const result = await apiGet('/api/accounts/list');
      accounts = Array.isArray(result.accounts) ? result.accounts : [];
      updateDashboard();
      renderTable();
    } catch (error) {
      if (error.status === 401) {
        showModal('提示', '为了防止滥用，已增加密码验证功能。如需使用，请联系管理员获取密码或自行搭建服务。');
      } else {
        showModal('错误', '无法加载账号数据，请稍后重试。');
      }
    } finally {
      hideLoading();
    }
  }

  function getImportedRows(content, delimiter) {
    if (typeof mailImportUtils.parseEmailText !== 'function') {
      showModal('错误', '导入组件加载失败，请刷新页面后重试。');
      return [];
    }

    return mailImportUtils.parseEmailText(content, delimiter);
  }

  async function saveImportedRows(rows) {
    if (rows.length === 0) {
      showModal('错误', '未识别到有效邮箱数据，请检查分隔符和导入格式。');
      return false;
    }

    showLoading();
    try {
      const result = await apiPost('/api/accounts/import', { rows });
      accounts = Array.isArray(result.accounts) ? result.accounts : accounts;
      currentPage = 1;
      updateDashboard();
      renderTable();
      showModal('导入成功', `成功导入 ${result.importedCount} 条邮箱数据。`);
      return true;
    } catch (error) {
      if (error.status === 401) {
        showModal('提示', '请输入正确的管理密码后再导入账号。');
      } else {
        showModal('错误', '导入失败，请检查数据格式后重试。');
      }
      return false;
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

  async function deleteEmail(accountId) {
    if (!window.confirm('确定要删除这个账号吗？')) {
      return;
    }

    showLoading();
    try {
      await apiPost('/api/accounts/delete', { accountId });
      await loadData();
      showModal('删除成功', '账号已成功删除。');
    } catch (error) {
      showModal('错误', '删除失败，请稍后重试。');
      hideLoading();
    }
  }

  async function batchDelete() {
    if (selectedItems.length === 0) {
      showModal('提示', '请先勾选要删除的账号。');
      return;
    }

    if (!window.confirm(`确定要批量删除选中的 ${selectedItems.length} 个账号吗？`)) {
      return;
    }

    showLoading();
    try {
      await apiPost('/api/accounts/batch-delete', {
        accountIds: selectedItems,
      });
      selectedItems = [];
      document.getElementById('select-all').checked = false;
      await loadData();
      showModal('删除成功', '批量删除已完成。');
    } catch (error) {
      showModal('错误', '批量删除失败，请稍后重试。');
      hideLoading();
    }
  }

  async function copyShareLink(accountId) {
    const account = accounts.find((item) => item.id === accountId);

    if (!account) {
      showModal('错误', '未找到对应的账号记录。');
      return;
    }

    const shareUrl = getShareUrl(account);

    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(shareUrl);
      showModal('复制成功', `分享链接已复制：<br>${escapeHtml(shareUrl)}`);
      return;
    }

    showModal('分享链接', escapeHtml(shareUrl));
  }

  async function resetShareLink(accountId) {
    if (!window.confirm('确定要重置这个账号的分享链接吗？旧链接会立刻失效。')) {
      return;
    }

    showLoading();
    try {
      const result = await apiPost('/api/accounts/reset-share', { accountId });
      accounts = accounts.map((account) =>
        account.id === accountId ? result.account : account
      );
      renderTable();
      showModal('重置成功', '新的分享链接已经生成。');
    } catch (error) {
      showModal('错误', '重置分享链接失败，请稍后重试。');
    } finally {
      hideLoading();
    }
  }

  async function loadMailList(accountId, mailbox) {
    showLoading();
    try {
      const result = await apiGet('/api/accounts/mail-list', {
        accountId,
        mailbox,
      });

      mailData = Array.isArray(result.messages) ? result.messages : [];
      currentMailPage = 1;
      document.getElementById('mail-list-title').textContent =
        mailbox === 'Junk' ? '垃圾箱邮件列表' : '收件箱邮件列表';
      document.getElementById('mail-list-subtitle').textContent = result.email;
      renderMailTable();
      showSection('mail-list');
    } catch (error) {
      if (error.status === 401) {
        showModal('提示', '请输入正确的管理密码后再查看邮件。');
      } else {
        showModal('错误', '无法加载邮件列表，请稍后重试。');
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
    localStorage.setItem('password', password);
  }

  function initializePassword() {
    const password = getAdminPassword();
    if (password) {
      document.getElementById('password').value = password;
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    initializePassword();
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
  window.copyShareLink = copyShareLink;
  window.resetShareLink = resetShareLink;
  window.closeModal = closeModal;
  window.closeMailModal = closeMailModal;
  window.setPassword = setPassword;
})();

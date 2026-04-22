(function () {
  const params = new URLSearchParams(window.location.search);
  const shareToken = params.get('share');
  let currentMailbox = 'INBOX';
  let mailData = [];
  let currentPage = 1;
  const itemsPerPage = 10;

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function setStatus(message) {
    document.getElementById('share-status').textContent = message;
  }

  function setFolderButtons() {
    document.getElementById('folder-inbox').classList.toggle('secondary', currentMailbox !== 'INBOX');
    document.getElementById('folder-junk').classList.toggle('secondary', currentMailbox !== 'Junk');
  }

  async function loadMailbox(mailbox) {
    currentMailbox = mailbox;
    setFolderButtons();

    if (!shareToken) {
      setStatus('缺少分享参数，无法加载邮件列表。');
      return;
    }

    setStatus('正在加载邮件列表...');

    try {
      const query = new URLSearchParams({
        share: shareToken,
        mailbox,
      });
      const response = await fetch(`/api/share-mail-list?${query.toString()}`);

      if (!response.ok) {
        throw new Error('load failed');
      }

      const result = await response.json();
      mailData = Array.isArray(result.messages) ? result.messages : [];
      currentPage = 1;
      document.getElementById('share-email').textContent = result.email || '共享邮箱列表';
      setStatus(
        mailbox === 'Junk'
          ? '当前显示垃圾箱邮件列表'
          : '当前显示收件箱邮件列表'
      );
      renderTable();
    } catch (error) {
      mailData = [];
      renderTable();
      setStatus('分享链接无效，或该链接已被重置。');
    }
  }

  function renderTable() {
    const tableBody = document.querySelector('#mail-table tbody');
    tableBody.innerHTML = '';

    const start = (currentPage - 1) * itemsPerPage;
    const pageData = mailData.slice(start, start + itemsPerPage);

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

    document.getElementById('no-data').style.display = mailData.length ? 'none' : 'block';
    renderPagination();
  }

  function renderPagination() {
    const pagination = document.getElementById('pagination');
    pagination.innerHTML = '';

    const totalPages = Math.max(1, Math.ceil(mailData.length / itemsPerPage));
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

  function changePage(page) {
    currentPage = page;
    renderTable();
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

  function closeMailModal() {
    document.getElementById('mail-modal').style.display = 'none';
  }

  document.getElementById('folder-inbox').addEventListener('click', () => loadMailbox('INBOX'));
  document.getElementById('folder-junk').addEventListener('click', () => loadMailbox('Junk'));

  window.loadMailbox = loadMailbox;
  window.changePage = changePage;
  window.viewMail = viewMail;
  window.closeMailModal = closeMailModal;

  setFolderButtons();
  loadMailbox(currentMailbox);
})();
